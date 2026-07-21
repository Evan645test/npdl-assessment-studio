import { afterEach, describe, expect, it, vi } from "vitest";
import legacyMarkdown from "@/data/examples/chem-reaction-rate.md?raw";
import { renderAssessmentMarkdown } from "@/lib/assessment-document";
import {
  assessmentExportFingerprint,
  buildCreateItemRequests,
  buildModuleCreateItemRequests,
  createGoogleFormsFromAssessment,
  getGoogleFormsExportIssue,
  getGoogleOAuthClientIdIssue,
  normalizeGoogleOAuthClientId,
} from "@/lib/google-forms";
import { splitModules } from "@/lib/markdown";
import { TEST_ASSESSMENT_DOCUMENT, TEST_FORM } from "@/test/assessment-fixture";

const TEST_CLIENT_ID = "123456789-npdltest.apps.googleusercontent.com";

interface FormRequestItem {
  title?: string;
  description?: string;
  pageBreakItem?: Record<string, never>;
  textItem?: Record<string, never>;
  questionItem?: {
    question?: {
      required?: boolean;
      textQuestion?: { paragraph?: boolean };
      choiceQuestion?: unknown;
    };
  };
}

function requestItems(requests: ReturnType<typeof buildCreateItemRequests>): FormRequestItem[] {
  return requests.map((request) => request.createItem.item as FormRequestItem);
}

describe("Google Forms Q4 export", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exports each new Q4 as three required guided paragraph fields", () => {
    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    const items = requestItems(buildCreateItemRequests(modules[1], modules[2]));
    const guided = items.filter((item) =>
      /^(診斷|遷移)四｜步驟 [1-3] · /.test(item.title ?? ""),
    );

    expect(guided).toHaveLength(6);
    expect(guided.map((item) => item.title)).toEqual([
      "診斷四｜步驟 1 · 概念理解",
      "診斷四｜步驟 2 · 行動應用",
      "診斷四｜步驟 3 · 生活遷移",
      "遷移四｜步驟 1 · 概念理解",
      "遷移四｜步驟 2 · 行動應用",
      "遷移四｜步驟 3 · 生活遷移",
    ]);
    expect(guided.every((item) => item.questionItem?.question?.required === true)).toBe(true);
    expect(guided.every((item) => item.questionItem?.question?.textQuestion?.paragraph === true)).toBe(true);
    expect(guided.every((item) => item.description?.includes("先看哪裡"))).toBe(true);
    expect(guided.every((item) => item.description?.includes("可以這樣開始"))).toBe(true);
    expect(guided.every((item) => !item.description?.includes("共同題幹："))).toBe(true);
    expect(items.filter((item) => item.questionItem)).toHaveLength(12);
    for (const [content, type] of [[modules[1], "pre"], [modules[2], "post"]] as const) {
      const moduleItems = requestItems(buildModuleCreateItemRequests(content, type));
      expect(moduleItems.filter((item) => item.pageBreakItem)).toHaveLength(6);
      expect(moduleItems.filter((item) => item.questionItem?.question?.choiceQuestion)).toHaveLength(3);
      expect(moduleItems.filter((item) => item.questionItem?.question?.textQuestion)).toHaveLength(3);
      expect(moduleItems.some((item) => item.title === "共同題幹")).toBe(true);
      expect(
        moduleItems.find((item) => item.title?.includes("情境說明"))?.description,
      ).toContain(
        type === "pre" ? "兩盒點心在同一天開始記錄" : "兩組都沿用課堂的觀察表",
      );
      expect(
        moduleItems.find((item) => item.questionItem?.question?.choiceQuestion)?.title,
      ).toMatch(type === "pre" ? /^診斷一/ : /^遷移一/);
    }
  });

  it("blocks export when a new guided Q4 is missing its scaffold", () => {
    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    const malformedPre = modules[1].replace(
      /> \*\*先看哪裡\*\*：[^\n]+\n/,
      "",
    );

    expect(getGoogleFormsExportIssue(malformedPre, modules[2])).toContain("診斷題組第四題未通過品質檢查");
    expect(() => buildCreateItemRequests(malformedPre, modules[2])).toThrow("診斷題組第四題未通過品質檢查");
  });

  it("keeps one optional paragraph field for legacy Q4 Markdown", () => {
    const modules = splitModules(legacyMarkdown);
    const items = requestItems(buildCreateItemRequests(modules[1], modules[2]));
    const legacyQ4 = items.filter(
      (item) =>
        Boolean(item.questionItem?.question?.textQuestion) &&
        /^(診斷|遷移)四/.test(item.title ?? "") &&
        !/步驟/.test(item.title ?? ""),
    );

    expect(legacyQ4).toHaveLength(2);
    expect(legacyQ4.every((item) => item.questionItem?.question?.required === false)).toBe(true);
    expect(items.some((item) => /^(診斷|遷移)四｜步驟 [1-3] · /.test(item.title ?? ""))).toBe(false);
  });

  it("authorizes once and creates pre/post forms sequentially", async () => {
    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    const tokenRequests = vi.fn();
    vi.stubGlobal("window", {
      google: { accounts: { oauth2: { initTokenClient: (config: any) => ({
        requestAccessToken: () => {
          tokenRequests();
          config.callback({ access_token: "token" });
        },
      }) } } },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "pre-id", responderUri: "https://pre" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "pre-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "post-id", responderUri: "https://post" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "post-id" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createGoogleFormsFromAssessment({
      clientId: TEST_CLIENT_ID,
      form: TEST_FORM,
      indicatorName: TEST_FORM.customIndicator,
      preContent: modules[1],
      postContent: modules[2],
    });

    expect(tokenRequests).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result.pre?.status).toBe("complete");
    expect(result.post?.status).toBe("complete");
    const preCreate = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const postCreate = JSON.parse((fetchMock.mock.calls[3][1] as RequestInit).body as string);
    expect(preCreate.info.title).toBe(`${TEST_FORM.subject}｜${TEST_FORM.activityName}｜診斷題組`);
    expect(postCreate.info.title).toBe(`${TEST_FORM.subject}｜${TEST_FORM.activityName}｜遷移題組`);
    expect(fetchMock.mock.calls[2][0]).toBe("https://forms.googleapis.com/v1/forms/pre-id:setPublishSettings");
    expect(fetchMock.mock.calls[5][0]).toBe("https://forms.googleapis.com/v1/forms/post-id:setPublishSettings");
    const publishBody = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string);
    expect(publishBody).toEqual({
      publishSettings: {
        publishState: {
          isPublished: true,
          isAcceptingResponses: true,
        },
      },
      updateMask: "publishState",
    });
  });

  it("can publish the course-side pre form before post generation", async () => {
    const modules = splitModules(
      renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM),
    );
    vi.stubGlobal("window", {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (config: any) => ({
              requestAccessToken: () =>
                config.callback({ access_token: "token" }),
            }),
          },
        },
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ formId: "pre-only", responderUri: "https://pre" }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ formId: "pre-only" }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createGoogleFormsFromAssessment({
      clientId: TEST_CLIENT_ID,
      form: TEST_FORM,
      indicatorName: TEST_FORM.customIndicator,
      preContent: modules[1],
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.pre?.status).toBe("complete");
    expect(result.post).toBeUndefined();
    expect(result.preFingerprint).toBeTruthy();
  });

  it("retries only the missing form after a partial success", async () => {
    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    vi.stubGlobal("window", {
      google: { accounts: { oauth2: { initTokenClient: (config: any) => ({
        requestAccessToken: () => config.callback({ access_token: "token" }),
      }) } } },
    });
    const firstFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "pre-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "pre-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", firstFetch);
    const first = await createGoogleFormsFromAssessment({
      clientId: TEST_CLIENT_ID, form: TEST_FORM, indicatorName: "指標",
      preContent: modules[1], postContent: modules[2],
    });
    expect(first.pre?.status).toBe("complete");
    expect(first.post?.status).toBe("error");

    const retryFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "post-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "post-id" }), { status: 200 }));
    vi.stubGlobal("fetch", retryFetch);
    const retried = await createGoogleFormsFromAssessment({
      clientId: TEST_CLIENT_ID, form: TEST_FORM, indicatorName: "指標",
      preContent: modules[1], postContent: modules[2], existing: first,
    });
    expect(retryFetch).toHaveBeenCalledTimes(3);
    expect(retried.pre?.formId).toBe("pre-id");
    expect(retried.post?.formId).toBe("post-id");
  });

  it("resumes publishing without recreating or duplicating items after publish failure", async () => {
    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    vi.stubGlobal("window", {
      google: { accounts: { oauth2: { initTokenClient: (config: any) => ({
        requestAccessToken: () => config.callback({ access_token: "token" }),
      }) } } },
    });
    const firstFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "pre-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "pre-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "post-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ form: { responderUri: "https://post" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: "publish unavailable" },
      }), { status: 503 }));
    vi.stubGlobal("fetch", firstFetch);

    const first = await createGoogleFormsFromAssessment({
      clientId: TEST_CLIENT_ID,
      form: TEST_FORM,
      indicatorName: "指標",
      preContent: modules[1],
      postContent: modules[2],
    });

    expect(first.pre?.status).toBe("complete");
    expect(first.post?.status).toBe("partial");
    expect(first.post?.stage).toBe("content_applied");
    expect(first.post?.error).toContain("publish unavailable");

    const retryFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "post-id" }), { status: 200 }));
    vi.stubGlobal("fetch", retryFetch);
    const retried = await createGoogleFormsFromAssessment({
      clientId: TEST_CLIENT_ID,
      form: TEST_FORM,
      indicatorName: "指標",
      preContent: modules[1],
      postContent: modules[2],
      existing: first,
    });

    expect(retryFetch).toHaveBeenCalledTimes(1);
    expect(retryFetch.mock.calls[0][0]).toBe(
      "https://forms.googleapis.com/v1/forms/post-id:setPublishSettings",
    );
    expect(retried.post?.status).toBe("complete");
    expect(retried.post?.stage).toBe("published");
  });

  it("validates the Google OAuth Web Client ID before opening authorization", async () => {
    expect(normalizeGoogleOAuthClientId(`  ${TEST_CLIENT_ID}  `)).toBe(TEST_CLIENT_ID);
    expect(getGoogleOAuthClientIdIssue("client-id")).toContain(".apps.googleusercontent.com");

    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    await expect(createGoogleFormsFromAssessment({
      clientId: "client-id",
      form: TEST_FORM,
      indicatorName: "指標",
      preContent: modules[1],
      postContent: modules[2],
    })).rejects.toThrow(".apps.googleusercontent.com");
  });

  it("publishes legacy completed export records without duplicating their items", async () => {
    const modules = splitModules(renderAssessmentMarkdown(TEST_ASSESSMENT_DOCUMENT, TEST_FORM));
    vi.stubGlobal("window", {
      google: { accounts: { oauth2: { initTokenClient: (config: any) => ({
        requestAccessToken: () => config.callback({ access_token: "token" }),
      }) } } },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "pre-id" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ formId: "post-id" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const indicatorName = "指標";
    const fingerprint = assessmentExportFingerprint(
      TEST_FORM,
      indicatorName,
      modules[1],
      modules[2],
    );

    const result = await createGoogleFormsFromAssessment({
      clientId: TEST_CLIENT_ID,
      form: TEST_FORM,
      indicatorName,
      preContent: modules[1],
      postContent: modules[2],
      existing: {
        fingerprint,
        updatedAt: Date.now(),
        pre: {
          type: "pre",
          status: "complete",
          formId: "pre-id",
          editUrl: "https://docs.google.com/forms/d/pre-id/edit",
        },
        post: {
          type: "post",
          status: "complete",
          formId: "post-id",
          editUrl: "https://docs.google.com/forms/d/post-id/edit",
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith(":setPublishSettings"))).toBe(true);
    expect(result.pre?.stage).toBe("published");
    expect(result.post?.stage).toBe("published");
  });
});

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CourseIdeationApp from "@/features/course-ideation/CourseIdeationApp";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CourseIdeationApp />
  </StrictMode>,
);

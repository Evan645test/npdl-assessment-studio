import "@/index.css";

const target = new URL(import.meta.env.BASE_URL, window.location.origin);
window.location.replace(target);

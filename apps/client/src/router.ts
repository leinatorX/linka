import { createRouter, createWebHistory } from "vue-router";

const EmptyRoute = { template: "<span />" };

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: EmptyRoute },
    { path: "/category/:slug", name: "category", component: EmptyRoute },
    { path: "/settings", name: "settings", component: EmptyRoute },
    { path: "/:pathMatch(.*)*", redirect: "/" }
  ]
});

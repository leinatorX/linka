import { createRouter, createWebHistory } from "vue-router";

const EmptyRoute = { template: "<span />" };

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: EmptyRoute },
    { path: "/settings", component: EmptyRoute },
    { path: "/:pathMatch(.*)*", redirect: "/" }
  ]
});

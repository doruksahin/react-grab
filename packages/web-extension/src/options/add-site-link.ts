import { ADD_SITE_ANCHOR_ID } from "./anchor-id.js";

const ORIGIN_PARAM = "origin";

/** The settings-page path that opens the "Enable a site" form with `origin` filled in. */
export const addSitePath = (origin: string): string =>
  `?${new URLSearchParams({ [ORIGIN_PARAM]: origin })}#${ADD_SITE_ANCHOR_ID}`;

/** The site address an add-site link carries, from `location.search`. */
export const linkedSiteOrigin = (search: string): string =>
  new URLSearchParams(search).get(ORIGIN_PARAM) ?? "";

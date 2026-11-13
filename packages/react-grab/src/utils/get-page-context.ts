interface PageContext {
  pageUrl: string;
  pageTitle: string;
}

export const getPageContext = (): PageContext => ({
  pageUrl: window.location.href,
  pageTitle: document.title,
});

const PopupSize = {
  width: 360,
  height: 580
};

export function getExtensionURL(path: string): string {
  if (typeof chrome === "undefined") {
    return browser.runtime.getURL(path);
  } else {
    return chrome.runtime.getURL(path);
  }
}

export function openWindow(url: string) {
  const option = {
    width: PopupSize.width,
    height: PopupSize.height,
    url: url,
    type: "popup" as "popup"
  };

  /*
   If it runs on chrome, window is opened and replaced by using window.open().
   But if it runs on not chrome, window is opened by web extension api.
   This approach make some difference related to setting fee and signing process.
   In the prior case, setting fee window will not be closed and will be replaced by signing page.
   But, in the latter case, setting fee window will be closed and new signing page window will be opened.
   */
  if (typeof browser !== "undefined") {
    browser.windows.create({ allowScriptsToClose: true, ...option });
  } else {
    window.open(
      url,
      "Keplr",
      `width=${option.width}px,height=${option.height}px,scrollbars=0`,
      true
    );
  }
}

/**
 * window.open() has many options for sizing, but they require different ways to do this per web browser.
 * So, to avoid this problem, just manually set sizing if new window popup is opened.
 */
export function fitWindow() {
  // Get the gap size like title bar or menu bar, etc...
  const gap = {
    width: window.outerWidth - window.innerWidth,
    height: window.outerHeight - window.innerHeight
  };

  if (typeof chrome !== "undefined") {
    if (chrome.windows) {
      chrome.windows.getCurrent(window => {
        if (window?.id != null) {
          chrome.windows.update(window.id, {
            width: PopupSize.width + gap.width,
            height: PopupSize.height + gap.height
          });
        }
      });
      return;
    }
  }

  if (typeof browser !== "undefined") {
    if (browser.windows) {
      browser.windows.getCurrent().then(window => {
        if (window?.id != null) {
          browser.windows.update(window.id, {
            width: PopupSize.width + gap.width,
            height: PopupSize.height + gap.height
          });
        }
      });
      return;
    }
  }

  window.resizeTo(PopupSize.width + gap.width, PopupSize.height + gap.height);
}

/**
 * In some case, opened window has scrollbar even if scroll is unnecessary.
 * This can spoil the layout of content slightly.
 * So, if you are sure you don't need scrolling, use this function to remove scrolling.
 */
export function disableScroll() {
  const html = document.getElementsByTagName("html");
  html[0].style.overflow = "hidden";
}

export function enableScroll() {
  const html = document.getElementsByTagName("html");
  html[0].style.overflow = "";
}

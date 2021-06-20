chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { teams } = request;
  if (teams) {
    const url = `https://storage.cloud.google.com/nt-odds/${teams[0]}_${teams[1]}.json`;
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        sendResponse(json);
      })
      .catch(console.error);
  }
  return true;
});

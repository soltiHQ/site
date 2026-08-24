function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === "/docs") {
    request.uri = "/docs/index.html";
    return request;
  }

  if (uri.indexOf("/docs/") !== 0) {
    return request;
  }

  if (uri.charAt(uri.length - 1) === "/") {
    request.uri = uri + "index.html";
    return request;
  }

  var segments = uri.split("/").filter(function (segment) {
    return segment.length > 0;
  });
  var leaf = segments[segments.length - 1];

  if (segments.length === 2 && leaf.indexOf(".") === -1) {
    request.uri = uri + "/index.html";
    return request;
  }

  if (segments.length === 3 && (leaf === "latest" || /^\d+\.\d+$/.test(leaf))) {
    request.uri = uri + "/index.html";
    return request;
  }

  if (leaf.indexOf(".") === -1) {
    request.uri = uri + ".html";
  }

  return request;
}

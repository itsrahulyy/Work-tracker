const https = require("https");

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const get = (nextUrl) => {
      https
        .get(nextUrl, (res) => {
          if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            get(res.headers.location);
            return;
          }

          let raw = "";
          res.on("data", (chunk) => {
            raw += chunk;
          });
          res.on("end", () => {
            if (res.statusCode >= 400) {
              reject(new Error(`Request failed with status ${res.statusCode}: ${raw.slice(0, 200)}`));
              return;
            }
            resolve(raw);
          });
        })
        .on("error", reject);
    };

    get(url);
  });
}

function postJson(urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(urlString);
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: raw,
          });
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  fetchText,
  postJson,
};

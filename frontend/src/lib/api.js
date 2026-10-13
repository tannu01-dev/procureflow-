
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  let requestBody = options.body;

  // Convert plain JavaScript objects into valid JSON.
  if (
    requestBody !== undefined &&
    requestBody !== null &&
    typeof requestBody !== "string" &&
    !isFormData
  ) {
    requestBody = JSON.stringify(requestBody);
  }

  // Set the correct content type.
  if (isFormData) {
    // The browser sets the multipart boundary automatically.
    headers.delete("Content-Type");
  } else if (requestBody !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach the logged-in user's token.
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("procureflow_token");

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: requestBody,
  });

  // Handle both JSON and non-JSON server responses.
  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }
  }

  if (!response.ok) {
    const error = new Error(
      data.message || `API request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.code = data.code;
    error.data = data;

    throw error;
  }

  return data;
}
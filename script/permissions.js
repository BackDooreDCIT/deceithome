export async function has(permission) {
  try {
    return await chrome.permissions.contains({ permissions: [permission] });
  } catch {
    return false;
  }
}

export async function hasHost(origin) {
  try {
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

export async function request(permissions = [], origins = []) {
  try {
    return await chrome.permissions.request({ permissions, origins });
  } catch {
    return false;
  }
}

export async function revoke(permissions = [], origins = []) {
  try {
    return await chrome.permissions.remove({ permissions, origins });
  } catch {
    return false;
  }
}

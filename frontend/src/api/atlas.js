const API_BASE = '/api';

export async function getProduct() {
  const res = await fetch(`${API_BASE}/product`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getProductTree() {
  const res = await fetch(`${API_BASE}/product/tree`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getFolders(releaseId = null) {
  const params = new URLSearchParams();
  if (releaseId) params.set('releaseId', releaseId);
  const qs = params.toString();
  const url = qs ? `${API_BASE}/folders?${qs}` : `${API_BASE}/folders`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.folders ?? [];
}

export async function getFoldersTree(releaseId = null) {
  const params = new URLSearchParams();
  if (releaseId) params.set('releaseId', releaseId);
  const qs = params.toString();
  const url = qs ? `${API_BASE}/folders/tree?${qs}` : `${API_BASE}/folders/tree`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function buildContextQuery(releaseId = null) {
  const params = new URLSearchParams();
  if (releaseId) params.set('releaseId', releaseId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getFolder(id, releaseId = null) {
  const res = await fetch(`${API_BASE}/folders/folder/${id}${buildContextQuery(releaseId)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getItem(id, releaseId = null) {
  const res = await fetch(`${API_BASE}/folders/item/${id}${buildContextQuery(releaseId)}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getReleases() {
  const res = await fetch(`${API_BASE}/releases`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.releases ?? [];
}

export async function createFolder(body) {
  const params = new URLSearchParams();
  if (body?.releaseId) params.set('releaseId', body.releaseId);
  const qs = params.toString();
  const url = qs ? `${API_BASE}/folders/folder?${qs}` : `${API_BASE}/folders/folder`;
  const payload = { ...body };
  delete payload.releaseId;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function createItem(body) {
  const params = new URLSearchParams();
  if (body?.releaseId) params.set('releaseId', body.releaseId);
  const qs = params.toString();
  const url = qs ? `${API_BASE}/folders/item?${qs}` : `${API_BASE}/folders/item`;
  const payload = { ...body };
  delete payload.releaseId;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function updateFolder(id, body, releaseId = null) {
  const url = `${API_BASE}/folders/folder/${id}${buildContextQuery(releaseId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteFolder(id, releaseId = null) {
  const params = new URLSearchParams();
  if (releaseId) params.set('releaseId', releaseId);
  const qs = params.toString();
  const url = qs ? `${API_BASE}/folders/folder/${id}?${qs}` : `${API_BASE}/folders/folder/${id}`;
  const res = await fetch(url, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
}

export async function updateItem(id, body, releaseId = null) {
  const res = await fetch(`${API_BASE}/folders/item/${id}${buildContextQuery(releaseId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function addCommentToFolder(id, { text, scopeType, scopeId, releaseId = null }) {
  const res = await fetch(`${API_BASE}/folders/folder/${id}/comment${buildContextQuery(releaseId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, scopeType, scopeId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function addCommentToItem(id, { text, scopeType, scopeId, releaseId = null }) {
  const res = await fetch(`${API_BASE}/folders/item/${id}/comment${buildContextQuery(releaseId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, scopeType, scopeId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function updateFolderComment(id, commentId, body) {
  const res = await fetch(`${API_BASE}/folders/folder/${id}/comment/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function updateItemComment(id, commentId, body) {
  const res = await fetch(`${API_BASE}/folders/item/${id}/comment/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteFolderComment(id, commentId) {
  const res = await fetch(`${API_BASE}/folders/folder/${id}/comment/${commentId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
}

export async function deleteItemComment(id, commentId) {
  const res = await fetch(`${API_BASE}/folders/item/${id}/comment/${commentId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
}

export async function createRelease(body) {
  const res = await fetch(`${API_BASE}/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function updateRelease(id, body) {
  const res = await fetch(`${API_BASE}/releases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteRelease(id) {
  const res = await fetch(`${API_BASE}/releases/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
}

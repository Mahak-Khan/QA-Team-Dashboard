import api from "./api/axios";

export const getBugs = async (filterOrProjectId, testerId, category, severity, status) => {
  const params = {};
  if (typeof filterOrProjectId === "object" && filterOrProjectId !== null) {
    if (filterOrProjectId.projectId || filterOrProjectId.project_id) {
      params.project_id = filterOrProjectId.projectId || filterOrProjectId.project_id;
    }
    if (filterOrProjectId.testerId || filterOrProjectId.tester_id) {
      params.tester_id = filterOrProjectId.testerId || filterOrProjectId.tester_id;
    }
    if (filterOrProjectId.reporterId || filterOrProjectId.reporter_id) {
      params.reporter_id = filterOrProjectId.reporterId || filterOrProjectId.reporter_id;
    }
    if (filterOrProjectId.category && filterOrProjectId.category !== "all") {
      params.category = filterOrProjectId.category;
    }
    if (filterOrProjectId.severity && filterOrProjectId.severity !== "all") {
      params.severity = filterOrProjectId.severity;
    }
    if (filterOrProjectId.status && filterOrProjectId.status !== "all") {
      params.status = filterOrProjectId.status;
    }
  } else {
    if (filterOrProjectId) params.project_id = filterOrProjectId;
    if (testerId) params.tester_id = testerId;
    if (category && category !== "all") params.category = category;
    if (severity && severity !== "all") params.severity = severity;
    if (status && status !== "all") params.status = status;
  }
  const response = await api.get("/bugs/", { params });
  return response.data;
};

export const getBugById = async (bugId) => {
  const response = await api.get(`/bugs/${bugId}`);
  return response.data;
};

export const createBug = async (bugData) => {
  const response = await api.post("/bugs/", bugData);
  return response.data;
};

export const updateBug = async (bugId, bugData) => {
  const response = await api.patch(`/bugs/${bugId}`, bugData);
  return response.data;
};

export const updateBugStatus = async (bugId, status) => {
  const response = await api.patch(`/bugs/${bugId}/status`, { status });
  return response.data;
};

export const deleteBug = async (bugId) => {
  const response = await api.delete(`/bugs/${bugId}`);
  return response.data;
};

export const getBugSummary = async (testerId, projectId) => {
  const params = {};
  if (testerId) params.tester_id = testerId;
  if (projectId) params.project_id = projectId;
  const response = await api.get("/bugs/summary", { params });
  return response.data;
};


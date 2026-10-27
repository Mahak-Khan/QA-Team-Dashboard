import api from "./api/axios";

export const getBugs = async (projectId, testerId) => {
  const params = {};
  if (projectId) params.project_id = projectId;
  if (testerId) params.tester_id = testerId;
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


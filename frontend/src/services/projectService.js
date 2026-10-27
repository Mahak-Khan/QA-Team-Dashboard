import api from "./api/axios";

export const getProjects = async (testerId, projectId) => {
  const params = {};
  if (testerId) params.tester_id = testerId;
  if (projectId) params.project_id = projectId;
  const response = await api.get("/projects/", { params });
  return response.data;
};

export const getProjectById = async (id) => {
  const response = await api.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (project) => {
  const response = await api.post("/projects/", project);
  return response.data;
};

export const updateProjectStatus = async (projectId, status) => {
  const response = await api.patch(`/projects/${projectId}/status`, { status });
  return response.data;
};

export const getProjectUpdates = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/updates`);
  return response.data;
};

export const unassignTester = async (projectId, testerId) => {
  const response = await api.delete(`/projects/${projectId}/assign/${testerId}`);
  return response.data;
};

export const deleteProject = async (projectId) => {
  const response = await api.delete(`/projects/${projectId}`);
  return response.data;
};

export const updateProjectMetrics = async (projectId, metrics) => {
  const response = await api.patch(`/projects/${projectId}/sheet-metrics`, metrics);
  return response.data;
};

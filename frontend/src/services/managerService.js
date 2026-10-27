import api from "./api/axios";

export const getProjectProgress = async (testerId, projectId) => {
  const params = {};
  if (testerId) params.tester_id = testerId;
  if (projectId) params.project_id = projectId;
  const response = await api.get("/projects/progress", { params });
  return response.data;
};
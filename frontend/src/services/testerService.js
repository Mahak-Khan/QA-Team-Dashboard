import api from "./api/axios";

export const getTesterProjects = async () => {
  const response = await api.get("/projects/");
  return response.data;
};

export const saveProjectUpdate = async (projectId, updateData) => {
  const response = await api.post(
    `/projects/${projectId}/updates`,
    updateData
  );
  return response.data;
};

export const getProjectUpdates = async (projectId) => {
  const response = await api.get(`/projects/${projectId}/updates`);
  return response.data;
};

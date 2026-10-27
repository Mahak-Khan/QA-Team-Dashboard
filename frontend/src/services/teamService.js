import api from "./api/axios";

export const getTesters = async () => {
  const response = await api.get("/team/testers");
  return response.data;
};

export const createTester = async (testerData) => {
  const response = await api.post("/team/testers", testerData);
  return response.data;
};

export const assignTester = async (projectId, testerId) => {
  const response = await api.post(`/projects/${projectId}/assign`, {
    tester_id: Number(testerId),
  });
  return response.data;
};

export const toggleTesterStatus = async (testerId) => {
  const response = await api.patch(`/team/testers/${testerId}/status`);
  return response.data;
};

export const deleteTester = async (testerId) => {
  const response = await api.delete(`/team/testers/${testerId}`);
  return response.data;
};

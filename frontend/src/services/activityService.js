import api from "./api/axios";

export const getActivityPulse = async (testerId = null, days = 365) => {
  const params = { days };
  if (testerId) params.tester_id = testerId;
  const response = await api.get("/activity/pulse", { params });
  return response.data;
};

export const getRecentActivities = async (testerId = null, limit = 50) => {
  const params = { limit };
  if (testerId) params.tester_id = testerId;
  const response = await api.get("/activity/recent", { params });
  return response.data;
};

export const getTeamActivityOverview = async () => {
  const response = await api.get("/activity/team-overview");
  return response.data;
};

export const logActivity = async (payload) => {
  const response = await api.post("/activity/log", payload);
  return response.data;
};

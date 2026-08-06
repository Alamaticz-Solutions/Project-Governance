export const environment = {
  production: window.location.hostname !== 'localhost',
  apiUrl: window.location.hostname === 'localhost' 
    ? 'http://localhost:8000/api/v1' 
    : 'https://project-governance.onrender.com/api/v1'
};

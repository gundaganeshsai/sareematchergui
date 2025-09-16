// app.config.js
export default ({ config }) => {
  return {
    ...config,
    extra: {
      API_BASE: "https://sareematcherbackend.onrender.com" || "http://192.168.1.6:8000",
      "router": {},
      "eas": {
        "projectId": "73c8d3e0-11a9-4a4c-a3ae-3c2cd64cc0ee"
      }
    },
    "android": {
  "package": "com.saiganesh.sareematcher",
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "edgeToEdgeEnabled": true
}
  };
};

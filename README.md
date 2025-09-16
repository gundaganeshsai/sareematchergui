# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

🖥️ Backend (FastAPI + Python)
Create virtual environment
cd backend
python -m venv venv


Activate it:

Windows PowerShell

.\venv\Scripts\activate


Mac/Linux

source venv/bin/activate

Install backend requirements
pip install fastapi uvicorn opencv-python scikit-learn numpy python-multipart

Run backend server
uvicorn main:app --reload --port 8000
Run your backend to accept external connections

uvicorn main:app --reload --host 0.0.0.0 --port 8000

In Render
https://sareematcherbackend.onrender.com

The backend will run on:
👉 http://127.0.0.1:8000 (local machine).

📡 Connecting Frontend with Backend

In your frontend code (ColorMatcher.ts), update the backend URL:

class ColorMatcher {
  // ⚠️ Replace with your computer's local IP
  static backendUrl = "http://192.168.1.6:8000";
}


To find your local IP:

Windows: Run ipconfig → look for IPv4 Address.

Mac/Linux: Run ifconfig or ip a.

👉 If you are running the Expo app on real device, use http://<your-local-ip>:8000.
👉 If you are running on Android Emulator, use http://10.0.2.2:8000.

🧪 Testing API in Swagger UI

FastAPI comes with Swagger UI for free 🎉

Start your backend:

uvicorn main:app --reload --port 8000


Open in browser:

http://127.0.0.1:8000/docs


You can test:

/analyze → Upload one image (returns dominant colors + pixel positions).

/match → Upload two images (saree + rack) (returns color matches + confidence).

📝 Example Flow

Start backend:

cd backend
uvicorn main:app --reload --port 8000


Start frontend:
PwerShell
$env:EXPO_PUBLIC_API_BASE="http://192.168.1.6:8000"; npx expo start
Build for Production (Play Store)
EXPO_PUBLIC_API_BASE=https://sareematcher.onrender.com npx eas build -p android --profile production



Update ColorMatcher.backendUrl with your local IP.

Upload saree + rack images in the app.

Backend analyzes images and sends:

Dominant colors (hex).

Pixel positions (x,y).

Matches with confidence scores.

🔧 Requirements

Frontend:

Node.js ≥ 18

Expo Go app (Android/iOS)

Backend:

Python ≥ 3.9

FastAPI, Uvicorn, OpenCV, scikit-learn, numpy

✅ D



SareeMatcher

SareeMatcher is a mobile application built with React Native (Expo) for the frontend and FastAPI for the backend.

📌 Project Structure
SareeMatcher/
│── app/              # Expo Router app folder
│── components/       # React Native UI components
│── assets/           # Images, icons, splash
│── backend/          # FastAPI backend
│── package.json      # Frontend dependencies
│── eas.json          # Expo build config
│── app.json          # Expo app config
│── README.md         # Project guide

🚀 Backend Setup (FastAPI + Render)
1. Prepare your backend

Inside backend/ create a requirements.txt:

fastapi
uvicorn
python-dotenv
numpy
opencv-python
scikit-learn
webcolors
colormath
gunicorn


Ensure main.py has the FastAPI app:

from fastapi import FastAPI
app = FastAPI()

@app.get("/")
def home():
    return {"message": "SareeMatcher Backend Running ✅"}

2. Run locally
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000


Visit: http://localhost:8000

3. Deploy to Render

Push backend to GitHub.

Go to Render
.

Create New Web Service → Connect repo.

Use Start Command:

gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app


Render will provide a public URL, e.g.:

https://sareematcherbackend.onrender.com

📱 Frontend Setup (Expo React Native)
1. Install dependencies
cd SareeMatcher
npm install

2. Run locally
npx expo start


Scan QR with Expo Go app on your phone.

Make sure app.json has your backend API:

"extra": {
  "API_BASE": "https://sareematcherbackend.onrender.com"
}

📦 Build Mobile App (EAS Build)
1. Login to Expo
npx expo login

2. Configure eas.json

eas.json

{
  "cli": {
    "version": ">= 3.13.0"
  },
  "build": {
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}

3. Add Android package name

Edit app.json:

"android": {
  "package": "com.saiganeshgunda.sareematcher",
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  }
}

4. Build APK
eas build -p android --profile preview

5. Download APK

After build completes, Expo gives a download link.

Transfer APK to your phone (USB, Google Drive, or email).

Enable Install from unknown sources.

Install APK → Open SareeMatcher app 🚀

⚡ Extra Tips

To stop local backend:

Ctrl + C


To start backend again:

cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000


To test on emulator:

eas build -p android --profile preview


Then choose Y when asked to install on emulator.

For production release:

eas build -p android --profile production


✅ With this setup, your backend runs on Render and your frontend builds into an APK for testing on Android before Play Store deployment.

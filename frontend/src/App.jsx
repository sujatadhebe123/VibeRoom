import {
  useEffect,
  useState,
} from "react";

import {
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";

import "./App.css";

import vibeRoom from "./assets/vibe-room.png";
import Room from "./pages/Room";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

/* =========================
   GET / CREATE USER ID
========================= */

function getUserId() {
  let userId =
    sessionStorage.getItem(
      "vibeUserId"
    );

  if (!userId) {
    userId =
      "user_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2, 10);

    sessionStorage.setItem(
      "vibeUserId",
      userId
    );
  }

  return userId;
}

/* =========================
   GET INDIVIDUAL USER
   ROOMS STORAGE KEY
========================= */

function getUserRoomsKey() {
  const userId =
    getUserId();

  return `vibeRooms_${userId}`;
}

/* =========================
   HOME PAGE
========================= */

function HomePage() {
  const navigate =
    useNavigate();

  const [
    position,
    setPosition,
  ] = useState({
    x: 0,
    y: 0,
  });

  const [
    name,
    setName,
  ] = useState("");

  const [
    rooms,
    setRooms,
  ] = useState([]);

  const [
    joinCode,
    setJoinCode,
  ] = useState("");

  const [
    showJoin,
    setShowJoin,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  /* =========================
     LOAD USER DATA
  ========================= */

  useEffect(() => {
    const userId =
      getUserId();

    const savedName =
      sessionStorage.getItem(
        "listenerName"
      ) || "";

    setName(savedName);

    const roomsKey =
      `vibeRooms_${userId}`;

    const savedRooms =
      JSON.parse(
        localStorage.getItem(
          roomsKey
        )
      ) || [];

    setRooms(savedRooms);
  }, []);

  /* =========================
     BACKGROUND MOVEMENT
  ========================= */

  const handleMouseMove =
    (e) => {
      const x =
        (e.clientX /
          window.innerWidth -
          0.5) *
        16;

      const y =
        (e.clientY /
          window.innerHeight -
          0.5) *
        10;

      setPosition({
        x,
        y,
      });
    };

  /* =========================
     GENERATE ROOM CODE
  ========================= */

  const generateRoomCode =
    () => {
      return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
    };

  /* =========================
     SAVE USER ROOMS
  ========================= */

  const saveUserRooms =
    (updatedRooms) => {
      setRooms(
        updatedRooms
      );

      localStorage.setItem(
        getUserRoomsKey(),
        JSON.stringify(
          updatedRooms
        )
      );
    };

  /* =========================
     CREATE ROOM
  ========================= */

  const createRoom =
    async () => {
      if (
        name.trim() === ""
      ) {
        alert(
          "Please enter your name first."
        );

        return;
      }

      try {
        setLoading(true);

        const roomCode =
          generateRoomCode();

        const userId =
          getUserId();

        const response =
          await fetch(
            `${API_URL}/create-room`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  roomCode,

                  createdBy:
                    name.trim(),

                  adminId:
                    userId,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          alert(
            data.message ||
              "Could not create room."
          );

          return;
        }

        sessionStorage.setItem(
          "listenerName",
          name.trim()
        );

        const newRoom = {
          id: Date.now(),

          roomName:
            "My Vibe Room",

          roomCode:
            data.roomCode,

          createdBy:
            name.trim(),

          songs: 0,

          type:
            "created",
        };

        const updatedRooms = [
          newRoom,
          ...rooms,
        ];

        saveUserRooms(
          updatedRooms
        );

        navigate(
          `/room/${data.roomCode}`
        );
      } catch (error) {
        console.error(
          "Create room error:",
          error
        );

        alert(
          "Cannot connect to VibeRoom server."
        );
      } finally {
        setLoading(false);
      }
    };

  /* =========================
     JOIN ROOM
  ========================= */

  const joinRoom =
    async () => {
      if (
        name.trim() === ""
      ) {
        alert(
          "Please enter your name first."
        );

        return;
      }

      if (
        joinCode.trim() === ""
      ) {
        alert(
          "Please enter room code."
        );

        return;
      }

      const formattedCode =
        joinCode
          .trim()
          .toUpperCase();

      try {
        setLoading(true);

        const response =
          await fetch(
            `${API_URL}/room/${formattedCode}`
          );

        const data =
          await response.json();

        if (!response.ok) {
          alert(
            "Room not found. Please check the room code."
          );

          return;
        }

        getUserId();

        sessionStorage.setItem(
          "listenerName",
          name.trim()
        );

        const alreadyExists =
          rooms.some(
            (room) =>
              room.roomCode ===
              formattedCode
          );

        if (!alreadyExists) {
          const joinedRoom = {
            id: Date.now(),

            roomName:
              "Joined Vibe Room",

            roomCode:
              formattedCode,

            createdBy:
              data.room.createdBy,

            songs:
              data.room.playlist
                ?.length || 0,

            type:
              "joined",
          };

          const updatedRooms = [
            joinedRoom,
            ...rooms,
          ];

          saveUserRooms(
            updatedRooms
          );
        }

        navigate(
          `/room/${formattedCode}`
        );
      } catch (error) {
        console.error(
          "Join room error:",
          error
        );

        alert(
          "Cannot connect to VibeRoom server."
        );
      } finally {
        setLoading(false);
      }
    };

  /* =========================
     OPEN SAVED ROOM
  ========================= */

  const openRoom =
    async (roomCode) => {
      if (
        name.trim() === ""
      ) {
        alert(
          "Please enter your name first."
        );

        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/room/${roomCode}`
          );

        if (!response.ok) {
          alert(
            "This room is no longer active."
          );

          return;
        }

        getUserId();

        sessionStorage.setItem(
          "listenerName",
          name.trim()
        );

        navigate(
          `/room/${roomCode}`
        );
      } catch (error) {
        console.error(
          "Open room error:",
          error
        );

        alert(
          "Cannot connect to VibeRoom server."
        );
      }
    };

  /* =========================
     UI
  ========================= */

  return (
    <div
      className="home"
      onMouseMove={
        handleMouseMove
      }
    >
      <div className="night-bg">
      </div>

      <img
        src={vibeRoom}
        alt="VibeRoom"
        className="room-image"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(1.04)`,
        }}
      />

      <div className="content">

        <h1>
          <span>♫</span>{" "}
          VibeRoom
        </h1>

        <div className="tagline">

          <p>
            Your music.
          </p>

          <p>
            Your friends.
          </p>

          <p>
            Your atmosphere.
          </p>

        </div>

        <p className="description">
          Create a collaborative
          room. Share the link.
          <br />
          Listen together.
        </p>

        <div className="name-card">

          <label>
            WHO IS LISTENING?
          </label>

          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) =>
              setName(
                e.target.value
              )
            }
          />

        </div>

        <div className="buttons">

          <button
            className="create-btn"
            onClick={
              createRoom
            }
            disabled={
              loading
            }
          >
            {loading
              ? "Please wait..."
              : "+ Create Room"}
          </button>

          <button
            className="join-btn"
            onClick={() =>
              setShowJoin(
                !showJoin
              )
            }
            disabled={
              loading
            }
          >
            Join Room
          </button>

        </div>

        {showJoin && (
          <div className="join-box">

            <input
              type="text"
              placeholder="Enter room code"
              value={
                joinCode
              }
              maxLength={6}
              onChange={(e) =>
                setJoinCode(
                  e.target.value
                    .toUpperCase()
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  joinRoom();
                }
              }}
            />

            <button
              className="join-confirm-btn"
              onClick={
                joinRoom
              }
              disabled={
                loading
              }
            >
              Join
            </button>

            <button
              className="join-cancel-btn"
              onClick={() => {
                setShowJoin(
                  false
                );

                setJoinCode(
                  ""
                );
              }}
            >
              Cancel
            </button>

          </div>
        )}

        <p className="sync-text">

          Each listener enjoys
          their own atmosphere

          <span>
            {" "}·{" "}
          </span>

          Playlists sync together
          in real time

        </p>

        <div className="rooms-section">

          <h2>
            Your Rooms
          </h2>

          {rooms.length === 0 ? (

            <p className="no-rooms-text">
              No rooms yet.
              Create one or join
              with a friend's code.
            </p>

          ) : (

            rooms.map(
              (room) => (

                <div
                  className="room-card"
                  key={room.id}
                >

                  <div>

                    <h3>
                      {
                        room.roomName
                      }
                    </h3>

                    <p>
                      {
                        room.roomCode
                      }

                      {" · "}

                      {
                        room.songs
                      }{" "}
                      songs
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      openRoom(
                        room.roomCode
                      )
                    }
                  >
                    Open
                  </button>

                </div>

              )
            )

          )}

        </div>

      </div>
    </div>
  );
}

/* =========================
   APP ROUTES
========================= */

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={
          <HomePage />
        }
      />

      <Route
        path="/room/:roomCode"
        element={
          <Room />
        }
      />

    </Routes>
  );
}

export default App;
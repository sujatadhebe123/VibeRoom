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
    localStorage.getItem(
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

    localStorage.setItem(
      "vibeUserId",
      userId
    );
  }

  return userId;
}

/* =========================
   GET USER ROOMS KEY
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
    existingCode,
    setExistingCode,
  ] = useState("");

  const [
    showJoin,
    setShowJoin,
  ] = useState(false);

  const [
    showExisting,
    setShowExisting,
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
      localStorage.getItem(
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
     BACKGROUND
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
     ROOM CODE
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
     ADD ROOM TO YOUR ROOMS
  ========================= */

  const addRoomToSavedRooms =
    ({
      roomCode,
      roomName,
      createdBy,
      songs,
      type,
    }) => {

      const alreadyExists =
        rooms.some(
          (room) =>
            room.roomCode ===
            roomCode
        );

      if (alreadyExists) {
        return;
      }

      const newRoom = {
        id: Date.now(),

        roomName,

        roomCode,

        createdBy,

        songs: songs || 0,

        type,
      };

      const updatedRooms = [
        newRoom,
        ...rooms,
      ];

      saveUserRooms(
        updatedRooms
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

        localStorage.setItem(
          "listenerName",
          name.trim()
        );

        addRoomToSavedRooms({
          roomCode:
            data.roomCode,

          roomName:
            "My Vibe Room",

          createdBy:
            name.trim(),

          songs:
            0,

          type:
            "created",
        });

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
     JOIN FRIEND ROOM
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

        localStorage.setItem(
          "listenerName",
          name.trim()
        );

        addRoomToSavedRooms({
          roomCode:
            formattedCode,

          roomName:
            "Joined Vibe Room",

          createdBy:
            data.room.createdBy,

          songs:
            data.room.playlist
              ?.length || 0,

          type:
            "joined",
        });

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
     ALREADY HAVE A ROOM
  ========================= */

  const openExistingRoom =
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
        existingCode.trim() === ""
      ) {
        alert(
          "Please enter your previous room code."
        );

        return;
      }

      const formattedCode =
        existingCode
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
            "Room not found. Please check your room code."
          );

          return;
        }

        localStorage.setItem(
          "listenerName",
          name.trim()
        );

        const userId =
          getUserId();

        const isCreator =
          data.room.adminId ===
          userId;

        addRoomToSavedRooms({
          roomCode:
            formattedCode,

          roomName:
            isCreator
              ? "My Vibe Room"
              : "Saved Vibe Room",

          createdBy:
            data.room.createdBy,

          songs:
            data.room.playlist
              ?.length || 0,

          type:
            isCreator
              ? "created"
              : "saved",
        });

        navigate(
          `/room/${formattedCode}`
        );

      } catch (error) {
        console.error(
          "Open existing room error:",
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
            "This room is no longer available."
          );

          return;
        }

        localStorage.setItem(
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
          transform:
            `translate(${position.x}px, ${position.y}px) scale(1.04)`,
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
          room. Share the code.
          <br />

          Listen together.
        </p>

        {/* =====================
            NAME
        ===================== */}

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

        {/* =====================
            MAIN BUTTONS
        ===================== */}

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
            + Create Room
          </button>

          <button
            className="join-btn"
            onClick={() => {

              setShowJoin(
                !showJoin
              );

              setShowExisting(
                false
              );
            }}
            disabled={
              loading
            }
          >
            Join Room
          </button>

        </div>

        {/* =====================
            ALREADY HAVE ROOM
        ===================== */}

        <button
          className="already-room-btn"
          onClick={() => {

            setShowExisting(
              !showExisting
            );

            setShowJoin(
              false
            );
          }}
          disabled={
            loading
          }
        >
          🎵 Already Have a Room
        </button>

        {/* =====================
            JOIN FRIEND ROOM
        ===================== */}

        {showJoin && (
          <div className="join-box">

            <input
              type="text"
              placeholder="Enter friend's room code"
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

        {/* =====================
            EXISTING ROOM
        ===================== */}

        {showExisting && (
          <div className="existing-room-box">

            <input
              type="text"
              placeholder="Enter your previous room code"
              value={
                existingCode
              }
              maxLength={6}
              onChange={(e) =>
                setExistingCode(
                  e.target.value
                    .toUpperCase()
                )
              }
              onKeyDown={(e) => {

                if (
                  e.key ===
                  "Enter"
                ) {
                  openExistingRoom();
                }
              }}
            />

            <button
              className="existing-open-btn"
              onClick={
                openExistingRoom
              }
              disabled={
                loading
              }
            >
              Open
            </button>

            <button
              className="existing-cancel-btn"
              onClick={() => {

                setShowExisting(
                  false
                );

                setExistingCode(
                  ""
                );
              }}
            >
              Cancel
            </button>

          </div>
        )}

        {/* =====================
            SYNC MESSAGE
        ===================== */}

        <p className="sync-text">

          Each listener enjoys
          their own atmosphere

          <span>
            {" "}·{" "}
          </span>

          Playlists sync together
          in real time

        </p>

        {/* =====================
            YOUR ROOMS
        ===================== */}

        <div className="rooms-section">

          <h2>
            Your Rooms
          </h2>

          {rooms.length === 0 ? (

            <p className="no-rooms-text">
              No rooms yet.
              Create your own room,
              join a friend's room,
              or open a previous room.
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
   ROUTES
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
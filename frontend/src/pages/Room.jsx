import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { io } from "socket.io-client";

import roomBg from "../assets/room-bg-2.png";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const socket = io(API_URL);

/* =========================
   YOUTUBE VIDEO ID
========================= */

function getYouTubeVideoId(url) {
  try {
    const parsed =
      new URL(url);

    if (
      parsed.hostname.includes(
        "youtu.be"
      )
    ) {
      return parsed.pathname
        .slice(1)
        .split("/")[0];
    }

    if (
      parsed.hostname.includes(
        "youtube.com"
      )
    ) {
      if (
        parsed.pathname ===
        "/watch"
      ) {
        return parsed.searchParams.get(
          "v"
        );
      }

      if (
        parsed.pathname.startsWith(
          "/shorts/"
        )
      ) {
        return parsed.pathname.split(
          "/"
        )[2];
      }

      if (
        parsed.pathname.startsWith(
          "/embed/"
        )
      ) {
        return parsed.pathname.split(
          "/"
        )[2];
      }
    }
  } catch {
    return null;
  }

  return null;
}

/* =========================
   USER ID
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

function Room() {
  const { roomCode } =
    useParams();

  const navigate =
    useNavigate();

  const userId =
    getUserId();

  const listenerName =
    sessionStorage.getItem(
      "listenerName"
    ) || "Guest";

  const [
    position,
    setPosition,
  ] = useState({
    x: 0,
    y: 0,
  });

  const [
    songUrl,
    setSongUrl,
  ] = useState("");

  const [
    addingSong,
    setAddingSong,
  ] = useState(false);

  const [
    onlineUsers,
    setOnlineUsers,
  ] = useState([]);

  const [
    playlist,
    setPlaylist,
  ] = useState([]);

  const [
    selectedSong,
    setSelectedSong,
  ] = useState(null);

  const [
    adminId,
    setAdminId,
  ] = useState("");

  const [
    isPlaying,
    setIsPlaying,
  ] = useState(false);

  const [
    isMuted,
    setIsMuted,
  ] = useState(false);

  const [
    volume,
    setVolume,
  ] = useState(70);

  const playerRef =
    useRef(null);

  const playerContainerRef =
    useRef(null);

  const songInputRef =
    useRef(null);

  const isAdmin =
    adminId === userId;

  /* =========================
     SOCKET CONNECTION
  ========================= */

  useEffect(() => {
    socket.emit(
      "joinRoom",
      {
        roomCode,
        name: listenerName,
        userId,
      }
    );

    const handleUsers = (
      users
    ) => {
      setOnlineUsers(users);
    };

    const handlePlaylist = (
      songs
    ) => {
      setPlaylist(songs);

      setSelectedSong(
        (current) => {
          if (!current) {
            return null;
          }

          const updatedSong =
            songs.find(
              (song) =>
                song.id ===
                current.id
            );

          return (
            updatedSong ||
            null
          );
        }
      );
    };

    const handleRoomInfo = (
      data
    ) => {
      setAdminId(
        data.adminId
      );
    };

    const handleRoomError = (
      data
    ) => {
      alert(data.message);
      navigate("/");
    };

    const handleDeleteError = (
      data
    ) => {
      alert(data.message);
    };

    const handleAdminError = (
      data
    ) => {
      alert(data.message);
    };

    socket.on(
      "roomUsers",
      handleUsers
    );

    socket.on(
      "playlistUpdated",
      handlePlaylist
    );

    socket.on(
      "roomInfo",
      handleRoomInfo
    );

    socket.on(
      "roomError",
      handleRoomError
    );

    socket.on(
      "songDeleteError",
      handleDeleteError
    );

    socket.on(
      "adminError",
      handleAdminError
    );

    return () => {
      socket.emit(
        "leaveRoom",
        {
          roomCode,
        }
      );

      socket.off(
        "roomUsers",
        handleUsers
      );

      socket.off(
        "playlistUpdated",
        handlePlaylist
      );

      socket.off(
        "roomInfo",
        handleRoomInfo
      );

      socket.off(
        "roomError",
        handleRoomError
      );

      socket.off(
        "songDeleteError",
        handleDeleteError
      );

      socket.off(
        "adminError",
        handleAdminError
      );
    };
  }, [
    roomCode,
    listenerName,
    navigate,
    userId,
  ]);

  /* =========================
     LOAD YOUTUBE PLAYER API
  ========================= */

  useEffect(() => {
    if (
      window.YT &&
      window.YT.Player
    ) {
      return;
    }

    if (
      document.getElementById(
        "youtube-iframe-api"
      )
    ) {
      return;
    }

    const script =
      document.createElement(
        "script"
      );

    script.id =
      "youtube-iframe-api";

    script.src =
      "https://www.youtube.com/iframe_api";

    document.body.appendChild(
      script
    );
  }, []);

  /* =========================
     CREATE PLAYER
  ========================= */

  useEffect(() => {
    if (!selectedSong) {
      setIsPlaying(false);
      return;
    }

    const videoId =
      getYouTubeVideoId(
        selectedSong.url
      );

    if (!videoId) {
      return;
    }

    const createPlayer = () => {
      if (
        !window.YT ||
        !window.YT.Player ||
        !playerContainerRef.current
      ) {
        return;
      }

      if (
        playerRef.current
      ) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }

        playerRef.current =
          null;
      }

      playerRef.current =
        new window.YT.Player(
          playerContainerRef.current,
          {
            videoId,

            playerVars: {
              autoplay: 1,
              controls: 1,
              rel: 0,
            },

            events: {
              onReady: (
                event
              ) => {
                event.target.setVolume(
                  volume
                );

                if (isMuted) {
                  event.target.mute();
                }

                event.target.playVideo();
              },

              onStateChange: (
                event
              ) => {
                if (
                  event.data ===
                  window.YT
                    .PlayerState
                    .PLAYING
                ) {
                  setIsPlaying(
                    true
                  );
                }

                if (
                  event.data ===
                    window.YT
                      .PlayerState
                      .PAUSED ||
                  event.data ===
                    window.YT
                      .PlayerState
                      .ENDED
                ) {
                  setIsPlaying(
                    false
                  );
                }
              },
            },
          }
        );
    };

    if (
      window.YT &&
      window.YT.Player
    ) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady =
        createPlayer;
    }

    return () => {
      if (
        playerRef.current
      ) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }

        playerRef.current =
          null;
      }
    };
  }, [selectedSong]);

  /* =========================
     BACKGROUND MOVEMENT
  ========================= */

  const handleMouseMove = (
    e
  ) => {
    const x =
      (e.clientX /
        window.innerWidth -
        0.5) *
      18;

    const y =
      (e.clientY /
        window.innerHeight -
        0.5) *
      12;

    setPosition({
      x,
      y,
    });
  };

  /* =========================
     COPY ROOM CODE
  ========================= */

  const copyRoomCode =
    async () => {
      try {
        await navigator.clipboard.writeText(
          roomCode
        );

        alert(
          "Room code copied!"
        );
      } catch {
        alert(
          `Room code: ${roomCode}`
        );
      }
    };

  /* =========================
     INVITE
  ========================= */

  const handleInvite =
    async () => {
      const projectLink =
        window.location.origin;

      try {
        await navigator.clipboard.writeText(
          projectLink
        );

        alert(
          "VibeRoom project link copied!"
        );
      } catch {
        alert(
          projectLink
        );
      }
    };

  /* =========================
     FOCUS SONG INPUT
  ========================= */

  const focusSongInput =
    () => {
      songInputRef.current?.focus();

      songInputRef.current?.scrollIntoView(
        {
          behavior:
            "smooth",
          block:
            "center",
        }
      );
    };

  /* =========================
     ADD SONG
  ========================= */

  const addSong =
    async () => {
      const cleanUrl =
        songUrl.trim();

      if (!cleanUrl) {
        alert(
          "Paste a YouTube song link."
        );

        return;
      }

      const videoId =
        getYouTubeVideoId(
          cleanUrl
        );

      if (!videoId) {
        alert(
          "Please enter a valid YouTube link."
        );

        return;
      }

      try {
        setAddingSong(
          true
        );

        /*
          Get real YouTube
          title, channel and
          thumbnail.
        */

        const response =
          await fetch(
            `${API_URL}/youtube-info?url=${encodeURIComponent(
              cleanUrl
            )}`
          );

        const data =
          await response.json();

        if (!response.ok) {
          alert(
            data.message ||
              "Could not get song information."
          );

          return;
        }

        socket.emit(
          "addSong",
          {
            roomCode,

            songUrl:
              cleanUrl,

            addedBy:
              listenerName,

            ownerId:
              userId,

            title:
              data.title,

            authorName:
              data.authorName,

            thumbnail:
              data.thumbnail,
          }
        );

        setSongUrl("");
      } catch (error) {
        console.error(
          "Add song error:",
          error
        );

        alert(
          "Could not get YouTube song information."
        );
      } finally {
        setAddingSong(
          false
        );
      }
    };

  /* =========================
     DELETE SONG
  ========================= */

  const deleteSong = (
    songId
  ) => {
    socket.emit(
      "deleteSong",
      {
        roomCode,

        songId,

        requestedById:
          userId,
      }
    );
  };

  /* =========================
     CLEAR PLAYLIST
  ========================= */

  const clearPlaylist =
    () => {
      if (!isAdmin) {
        return;
      }

      const confirmed =
        window.confirm(
          "Clear all songs from this shared playlist?"
        );

      if (!confirmed) {
        return;
      }

      socket.emit(
        "clearPlaylist",
        {
          roomCode,

          requestedById:
            userId,
        }
      );
    };

  /* =========================
     SELECT SONG
  ========================= */

  const playSong = (
    song
  ) => {
    setSelectedSong(song);
  };

  /* =========================
     PREVIOUS SONG
  ========================= */

  const playPreviousSong =
    () => {
      if (
        playlist.length ===
        0
      ) {
        return;
      }

      if (!selectedSong) {
        setSelectedSong(
          playlist[0]
        );

        return;
      }

      const index =
        playlist.findIndex(
          (song) =>
            song.id ===
            selectedSong.id
        );

      if (index === -1) {
        setSelectedSong(
          playlist[0]
        );

        return;
      }

      const previous =
        index === 0
          ? playlist.length -
            1
          : index - 1;

      setSelectedSong(
        playlist[
          previous
        ]
      );
    };

  /* =========================
     NEXT SONG
  ========================= */

  const playNextSong =
    () => {
      if (
        playlist.length ===
        0
      ) {
        return;
      }

      if (!selectedSong) {
        setSelectedSong(
          playlist[0]
        );

        return;
      }

      const index =
        playlist.findIndex(
          (song) =>
            song.id ===
            selectedSong.id
        );

      if (index === -1) {
        setSelectedSong(
          playlist[0]
        );

        return;
      }

      const next =
        index ===
        playlist.length - 1
          ? 0
          : index + 1;

      setSelectedSong(
        playlist[next]
      );
    };

  /* =========================
     PLAY / PAUSE
  ========================= */

  const togglePlayPause =
    () => {
      if (!selectedSong) {
        if (
          playlist.length >
          0
        ) {
          setSelectedSong(
            playlist[0]
          );
        }

        return;
      }

      if (
        !playerRef.current
      ) {
        return;
      }

      const state =
        playerRef.current.getPlayerState();

      if (
        state ===
        window.YT
          .PlayerState
          .PLAYING
      ) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    };

  /* =========================
     MUTE / UNMUTE
  ========================= */

  const toggleMute =
    () => {
      if (
        !playerRef.current
      ) {
        return;
      }

      if (
        playerRef.current.isMuted()
      ) {
        playerRef.current.unMute();

        setIsMuted(
          false
        );

        if (
          volume === 0
        ) {
          setVolume(
            50
          );

          playerRef.current.setVolume(
            50
          );
        }
      } else {
        playerRef.current.mute();

        setIsMuted(
          true
        );
      }
    };

  /* =========================
     VOLUME
  ========================= */

  const changeVolume = (
    e
  ) => {
    const newVolume =
      Number(
        e.target.value
      );

    setVolume(
      newVolume
    );

    if (
      !playerRef.current
    ) {
      return;
    }

    playerRef.current.setVolume(
      newVolume
    );

    if (
      newVolume === 0
    ) {
      playerRef.current.mute();

      setIsMuted(
        true
      );
    } else {
      if (
        playerRef.current.isMuted()
      ) {
        playerRef.current.unMute();
      }

      setIsMuted(
        false
      );
    }
  };

  return (
    <div
      className="room-page"
      onMouseMove={
        handleMouseMove
      }
    >
      {/* BACKGROUND */}

      <img
        src={roomBg}
        alt="Music room"
        className="room-page-bg"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(1.05)`,
        }}
      />

      <div className="room-overlay"></div>

      <div className="room-content">

        {/* =====================
            HEADER
        ===================== */}

        <header className="room-header">

          <button
            className="brand-button"
            onClick={() =>
              navigate("/")
            }
          >
            <span>♫</span>

            VibeRoom
          </button>

          <div className="room-title-area">

            <h2>
              My Vibe Room
            </h2>

            <button
              className="room-code-button"
              onClick={
                copyRoomCode
              }
            >
              {roomCode} ⧉
            </button>

          </div>

          <div className="header-actions">

            <div className="online-users-box">

              <div className="online-count">

                <span className="online-dot"></span>

                {onlineUsers.length}{" "}
                online

              </div>

              <div className="online-names">

                {onlineUsers.map(
                  (user) => (
                    <span
                      key={
                        user.socketId
                      }
                    >
                      {user.name}
                    </span>
                  )
                )}

              </div>

            </div>

            <button
              className={
                isAdmin
                  ? "admin-button"
                  : "member-button"
              }
            >
              {isAdmin
                ? "👑 Admin"
                : "👤 Member"}
            </button>

            <button
              className="invite-button"
              onClick={
                handleInvite
              }
            >
              🔗 Invite
            </button>

          </div>

        </header>

        {/* =====================
            MAIN
        ===================== */}

        <main className="room-main">

          {/* =====================
              PLAYER
          ===================== */}

          <section className="player-card">

            {selectedSong ? (
              <>
                <div className="youtube-player">

                  <div
                    ref={
                      playerContainerRef
                    }
                    className="youtube-api-player"
                  ></div>

                </div>

                <h2>
                  {selectedSong.title ||
                    "Now Playing"}
                </h2>

                {selectedSong.authorName && (
                  <p className="playing-author">
                    {
                      selectedSong.authorName
                    }
                  </p>
                )}

                <p className="playing-added-by">
                  Added by{" "}
                  <strong>
                    {
                      selectedSong.addedBy
                    }
                  </strong>
                </p>

                {/* PLAYER CONTROLS */}

                <div className="room-song-controls">

                  <button
                    onClick={
                      playPreviousSong
                    }
                    title="Previous song"
                  >
                    ⏮
                  </button>

                  <button
                    className="main-room-play"
                    onClick={
                      togglePlayPause
                    }
                    title={
                      isPlaying
                        ? "Pause"
                        : "Play"
                    }
                  >
                    {isPlaying
                      ? "⏸"
                      : "▶"}
                  </button>

                  <button
                    onClick={
                      playNextSong
                    }
                    title="Next song"
                  >
                    ⏭
                  </button>

                  <button
                    onClick={
                      toggleMute
                    }
                    title={
                      isMuted
                        ? "Unmute"
                        : "Mute"
                    }
                  >
                    {isMuted
                      ? "🔇"
                      : "🔊"}
                  </button>

                </div>

                {/* VOLUME */}

                <div className="custom-volume-control">

                  <span>🔉</span>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={
                      volume
                    }
                    onChange={
                      changeVolume
                    }
                  />

                  <span>🔊</span>

                  <span className="volume-value">
                    {volume}%
                  </span>

                </div>
              </>
            ) : (
              <>
                <div className="player-icon">
                  ♪
                </div>

                <h2>
                  Silence in the Room
                </h2>

                <p>
                  Choose a song
                  from the shared
                  playlist or add
                  a YouTube song.
                </p>

                <div className="player-empty-line"></div>

                <div className="player-controls">

                  <button
                    onClick={
                      playPreviousSong
                    }
                  >
                    ⏮
                  </button>

                  <button
                    className="main-play-button"
                    onClick={
                      togglePlayPause
                    }
                  >
                    ▶
                  </button>

                  <button
                    onClick={
                      playNextSong
                    }
                  >
                    ⏭
                  </button>

                </div>
              </>
            )}

          </section>

          {/* =====================
              SHARED PLAYLIST
          ===================== */}

          <section className="playlist-card">

            <div className="playlist-heading">

              <h2>
                Shared Playlist
              </h2>

              <span className="song-count">
                {
                  playlist.length
                }
              </span>

            </div>

            {/* ADD */}

            <button
              className="playlist-add-button"
              onClick={
                focusSongInput
              }
            >
              + Add
            </button>

            {/* ADMIN CLEAR */}

            {isAdmin &&
              playlist.length >
                0 && (
                <button
                  className="clear-playlist-button"
                  onClick={
                    clearPlaylist
                  }
                >
                  Clear All
                </button>
              )}

            {/* EMPTY PLAYLIST */}

            {playlist.length ===
            0 ? (
              <div className="empty-playlist">

                <div className="music-notes">
                  ♫ ♪
                </div>

                <h3>
                  The queue is waiting
                </h3>

                <p>
                  Be the first
                  person to add
                  a YouTube song.
                </p>

              </div>
            ) : (
              <div className="playlist-list">

                {playlist.map(
                  (
                    song,
                    index
                  ) => {
                    const isMine =
                      song.ownerId ===
                      userId;

                    const canDelete =
                      isMine ||
                      isAdmin;

                    const active =
                      selectedSong?.id ===
                      song.id;

                    return (
                      <div
                        key={
                          song.id
                        }
                        className={`playlist-item ${
                          active
                            ? "active-song"
                            : ""
                        }`}
                      >

                        {/* SELECT SONG */}

                        <button
                          className="song-select-button"
                          onClick={() =>
                            playSong(
                              song
                            )
                          }
                        >

                          <span className="playlist-number">
                            {index + 1}
                          </span>

                          {/* THUMBNAIL */}

                          {song.thumbnail ? (
                            <img
                              src={
                                song.thumbnail
                              }
                              alt={
                                song.title ||
                                "YouTube song"
                              }
                              className="playlist-thumbnail"
                            />
                          ) : (
                            <div className="playlist-thumbnail-fallback">
                              ♪
                            </div>
                          )}

                          {/* SONG DETAILS */}

                          <span className="playlist-song-details">

                            <strong>
                              {song.title ||
                                "YouTube Song"}
                            </strong>

                            <span className="song-author">
                              {song.authorName ||
                                "YouTube"}
                            </span>

                            <small>
                              Added by{" "}
                              {
                                song.addedBy
                              }
                            </small>

                          </span>

                        </button>

                        {/* DELETE */}

                        {canDelete && (
                          <button
                            className="delete-song-button"
                            onClick={() =>
                              deleteSong(
                                song.id
                              )
                            }
                            title={
                              isAdmin &&
                              !isMine
                                ? "Admin delete"
                                : "Delete your song"
                            }
                          >
                            🗑
                          </button>
                        )}

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>

        </main>

        {/* =====================
            ADD SONG BAR
        ===================== */}

        <div className="add-song-card">

          <span className="link-icon">
            ♫
          </span>

          <input
            ref={
              songInputRef
            }
            type="text"
            placeholder="Paste YouTube song URL..."
            value={
              songUrl
            }
            disabled={
              addingSong
            }
            onChange={(e) =>
              setSongUrl(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key ===
                  "Enter" &&
                !addingSong
              ) {
                addSong();
              }
            }}
          />

          <button
            className="add-song-button"
            onClick={
              addSong
            }
            disabled={
              addingSong
            }
          >
            {addingSong
              ? "Adding..."
              : "+ Add"}
          </button>

        </div>

      </div>
    </div>
  );
}

export default Room;
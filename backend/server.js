require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

/* =====================================================
   APP SETUP
===================================================== */

const app = express();

/*
  Frontends allowed to communicate with this backend.

  Local URLs:
  - Vite localhost
  - Vite 127.0.0.1

  Production:
  - Vercel deployed VibeRoom
*/

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://vibe-room-rosy.vercel.app",
  FRONTEND_URL,
];

/* =====================================================
   EXPRESS CORS
===================================================== */

const corsOptions = {
  origin: function (origin, callback) {
    /*
      Requests such as Render health checks,
      Postman, etc. may not contain Origin.
    */

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log(
      "Blocked CORS origin:",
      origin
    );

    return callback(
      new Error("Not allowed by CORS")
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

/* =====================================================
   HTTP SERVER
===================================================== */

const server = http.createServer(app);

/* =====================================================
   SOCKET.IO
===================================================== */

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,

    methods: [
      "GET",
      "POST",
    ],

    credentials: true,
  },
});

/* =====================================================
   MONGODB SCHEMAS
===================================================== */

const songSchema =
  new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
      },

      url: {
        type: String,
        required: true,
      },

      title: {
        type: String,
        default: "YouTube Song",
      },

      authorName: {
        type: String,
        default: "YouTube",
      },

      thumbnail: {
        type: String,
        default: "",
      },

      addedBy: {
        type: String,
        required: true,
      },

      ownerId: {
        type: String,
        required: true,
      },

      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

const roomSchema =
  new mongoose.Schema(
    {
      roomCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
      },

      createdBy: {
        type: String,
        required: true,
        trim: true,
      },

      adminId: {
        type: String,
        required: true,
      },

      playlist: {
        type: [songSchema],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );

const Room =
  mongoose.model(
    "Room",
    roomSchema
  );

/* =====================================================
   ONLINE USERS
===================================================== */

const onlineUsers = {};

/* =====================================================
   HELPER FUNCTIONS
===================================================== */

/*
  Internal online users structure:

  {
    ROOMCODE: [
      {
        userId: "user_123",
        name: "Sujata",
        socketIds: [
          "socket_1",
          "socket_2"
        ]
      }
    ]
  }

  Same user can have multiple tabs/socket connections,
  but will appear only once in the online users list.
*/

function getRoomUserEntries(roomCode) {
  if (!onlineUsers[roomCode]) {
    onlineUsers[roomCode] = [];
  }

  return onlineUsers[roomCode];
}

/*
  Data sent to frontend.

  Only one visible entry is returned per userId.

  socketId is kept because Room.jsx may use it
  as a React key.
*/

function getRoomUsers(roomCode) {
  const users =
    getRoomUserEntries(roomCode);

  return users.map((user) => ({
    socketId:
      user.socketIds[0] ||
      user.userId,

    userId:
      user.userId,

    name:
      user.name,
  }));
}

/*
  Remove only one disconnected socket.

  If the same user still has another tab open,
  they remain online.
*/

function removeSocketFromRoom(
  roomCode,
  socketId
) {
  if (!onlineUsers[roomCode]) {
    return;
  }

  onlineUsers[roomCode].forEach(
    (user) => {
      user.socketIds =
        user.socketIds.filter(
          (id) =>
            id !== socketId
        );
    }
  );

  /*
    Remove users only when they have
    no active sockets remaining.
  */

  onlineUsers[roomCode] =
    onlineUsers[roomCode].filter(
      (user) =>
        user.socketIds.length > 0
    );

  /*
    This only removes temporary online presence.
    It does NOT delete the MongoDB room.
  */

  if (
    onlineUsers[roomCode].length === 0
  ) {
    delete onlineUsers[roomCode];
  }
}

/* =====================================================
   TEST ROUTE
===================================================== */

app.get("/", (req, res) => {
  res.send(
    "VibeRoom backend is running"
  );
});

/* =====================================================
   CREATE ROOM
===================================================== */

app.post(
  "/create-room",
  async (req, res) => {
    try {
      const {
        roomCode,
        createdBy,
        adminId,
      } = req.body;

      if (
        !roomCode ||
        !createdBy ||
        !adminId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Room code, creator name and admin ID are required.",
          });
      }

      const code =
        roomCode
          .trim()
          .toUpperCase();

      const existingRoom =
        await Room.findOne({
          roomCode: code,
        });

      if (existingRoom) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Room already exists.",
          });
      }

      const newRoom =
        await Room.create({
          roomCode: code,

          createdBy:
            createdBy.trim(),

          adminId,

          playlist: [],
        });

      console.log(
        "Room created:",
        newRoom.roomCode
      );

      return res.json({
        success: true,

        roomCode:
          newRoom.roomCode,
      });
    } catch (error) {
      console.error(
        "Create room error:",
        error
      );

      if (
        error.code === 11000
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Room already exists.",
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Could not create room.",
        });
    }
  }
);

/* =====================================================
   GET ROOM
===================================================== */

app.get(
  "/room/:roomCode",
  async (req, res) => {
    try {
      const roomCode =
        req.params.roomCode
          .trim()
          .toUpperCase();

      const room =
        await Room.findOne({
          roomCode,
        });

      if (!room) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Room not found.",
          });
      }

      const users =
        getRoomUsers(
          roomCode
        );

      return res.json({
        success: true,

        room: {
          roomCode:
            room.roomCode,

          createdBy:
            room.createdBy,

          adminId:
            room.adminId,

          playlist:
            room.playlist,

          onlineCount:
            users.length,
        },
      });
    } catch (error) {
      console.error(
        "Get room error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Could not get room.",
        });
    }
  }
);

/* =====================================================
   YOUTUBE VIDEO INFORMATION
===================================================== */

app.get(
  "/youtube-info",
  async (req, res) => {
    const { url } =
      req.query;

    if (!url) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "YouTube URL is required.",
        });
    }

    try {
      const youtubeResponse =
        await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(
            url
          )}&format=json`
        );

      if (
        !youtubeResponse.ok
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Could not get YouTube video information.",
          });
      }

      const data =
        await youtubeResponse.json();

      return res.json({
        success: true,

        title:
          data.title,

        authorName:
          data.author_name,

        thumbnail:
          data.thumbnail_url,
      });
    } catch (error) {
      console.error(
        "YouTube info error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Could not get YouTube video information.",
        });
    }
  }
);

/* =====================================================
   SOCKET.IO
===================================================== */

io.on(
  "connection",
  (socket) => {
    console.log(
      "User connected:",
      socket.id
    );

    /* =================================================
       JOIN ROOM
    ================================================= */

    socket.on(
      "joinRoom",
      async ({
        roomCode,
        name,
        userId,
      }) => {
        try {
          if (
            !roomCode ||
            !name ||
            !userId
          ) {
            socket.emit(
              "roomError",
              {
                message:
                  "Room code, name and user ID are required.",
              }
            );

            return;
          }

          const code =
            roomCode
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomCode: code,
            });

          if (!room) {
            socket.emit(
              "roomError",
              {
                message:
                  "Room does not exist.",
              }
            );

            return;
          }

          /*
            Remove socket from old room
            if needed.
          */

          if (
            socket.data.roomCode &&
            socket.data.roomCode !== code
          ) {
            const oldRoom =
              socket.data.roomCode;

            removeSocketFromRoom(
              oldRoom,
              socket.id
            );

            socket.leave(
              oldRoom
            );

            io.to(
              oldRoom
            ).emit(
              "roomUsers",
              getRoomUsers(
                oldRoom
              )
            );
          }

          socket.join(code);

          /*
            Store identity for this socket.
          */

          socket.data.roomCode =
            code;

          socket.data.userId =
            userId;

          socket.data.name =
            name.trim();

          /*
            Get internal online users.
          */

          const users =
            getRoomUserEntries(code);

          /*
            Find same person by persistent userId.

            Important:
            We do NOT check only socketId because
            every browser tab gets a different socketId.
          */

          const existingUser =
            users.find(
              (user) =>
                user.userId ===
                userId
            );

          if (existingUser) {
            /*
              User already exists in this room.

              Update display name in case
              it has changed.
            */

            existingUser.name =
              name.trim();

            /*
              Add this tab's socket to the same user.
            */

            if (
              !existingUser.socketIds.includes(
                socket.id
              )
            ) {
              existingUser.socketIds.push(
                socket.id
              );
            }
          } else {
            /*
              Completely new person in the room.
            */

            users.push({
              userId,

              name:
                name.trim(),

              socketIds: [
                socket.id,
              ],
            });
          }

          /*
            Send duplicate-free users.
          */

          io.to(code).emit(
            "roomUsers",
            getRoomUsers(code)
          );

          /*
            Send persisted playlist
            from MongoDB to this listener.
          */

          socket.emit(
            "playlistUpdated",
            room.playlist
          );

          /*
            Send room/admin information.
          */

          socket.emit(
            "roomInfo",
            {
              adminId:
                room.adminId,

              createdBy:
                room.createdBy,
            }
          );

          console.log(
            `${name} joined room ${code}`
          );
        } catch (error) {
          console.error(
            "Join room error:",
            error
          );

          socket.emit(
            "roomError",
            {
              message:
                "Could not join room.",
            }
          );
        }
      }
    );

    /* =================================================
       LEAVE ROOM
    ================================================= */

    socket.on(
      "leaveRoom",
      ({ roomCode }) => {
        if (!roomCode) {
          return;
        }

        const code =
          roomCode
            .trim()
            .toUpperCase();

        /*
          Remove only this socket.

          If the same user has another tab,
          they remain online.
        */

        removeSocketFromRoom(
          code,
          socket.id
        );

        socket.leave(code);

        if (
          socket.data.roomCode ===
          code
        ) {
          socket.data.roomCode =
            null;
        }

        io.to(code).emit(
          "roomUsers",
          getRoomUsers(code)
        );
      }
    );

    /* =================================================
       ADD SONG
    ================================================= */

    socket.on(
      "addSong",
      async ({
        roomCode,
        songUrl,
        title,
        authorName,
        thumbnail,
      }) => {
        try {
          if (
            !roomCode ||
            !songUrl
          ) {
            return;
          }

          const code =
            roomCode
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomCode: code,
            });

          if (!room) {
            socket.emit(
              "roomError",
              {
                message:
                  "Room does not exist.",
              }
            );

            return;
          }

          const ownerId =
            socket.data.userId;

          const addedBy =
            socket.data.name;

          if (
            !ownerId ||
            !addedBy
          ) {
            socket.emit(
              "roomError",
              {
                message:
                  "Please join the room before adding songs.",
              }
            );

            return;
          }

          const newSong = {
            id:
              Date.now().toString() +
              Math.random()
                .toString(36)
                .substring(
                  2,
                  8
                ),

            url:
              songUrl.trim(),

            title:
              title ||
              "YouTube Song",

            authorName:
              authorName ||
              "YouTube",

            thumbnail:
              thumbnail || "",

            addedBy,

            ownerId,

            addedAt:
              new Date(),
          };

          room.playlist.push(
            newSong
          );

          /*
            Save song permanently in MongoDB.
          */

          await room.save();

          /*
            Update every listener in the room.
          */

          io.to(code).emit(
            "playlistUpdated",
            room.playlist
          );

          console.log(
            `${addedBy} added "${newSong.title}" in ${code}`
          );
        } catch (error) {
          console.error(
            "Add song error:",
            error
          );

          socket.emit(
            "roomError",
            {
              message:
                "Could not add song.",
            }
          );
        }
      }
    );

    /* =================================================
       DELETE SONG
    ================================================= */

    socket.on(
      "deleteSong",
      async ({
        roomCode,
        songId,
      }) => {
        try {
          if (
            !roomCode ||
            !songId
          ) {
            return;
          }

          const code =
            roomCode
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomCode: code,
            });

          if (!room) {
            socket.emit(
              "roomError",
              {
                message:
                  "Room does not exist.",
              }
            );

            return;
          }

          const song =
            room.playlist.find(
              (item) =>
                item.id ===
                songId
            );

          if (!song) {
            socket.emit(
              "songDeleteError",
              {
                message:
                  "Song not found.",
              }
            );

            return;
          }

          const currentUserId =
            socket.data.userId;

          if (!currentUserId) {
            socket.emit(
              "songDeleteError",
              {
                message:
                  "User identity not found.",
              }
            );

            return;
          }

          const isAdmin =
            room.adminId ===
            currentUserId;

          const isOwner =
            song.ownerId ===
            currentUserId;

          /*
            Admin:
            Can delete any song.

            Normal member:
            Can delete only their own song.
          */

          if (
            !isAdmin &&
            !isOwner
          ) {
            socket.emit(
              "songDeleteError",
              {
                message:
                  "You can delete only songs added by you.",
              }
            );

            return;
          }

          room.playlist =
            room.playlist.filter(
              (item) =>
                item.id !==
                songId
            );

          /*
            Save updated playlist permanently.
          */

          await room.save();

          io.to(code).emit(
            "playlistUpdated",
            room.playlist
          );

          console.log(
            `Song deleted from ${code}`
          );
        } catch (error) {
          console.error(
            "Delete song error:",
            error
          );

          socket.emit(
            "songDeleteError",
            {
              message:
                "Could not delete song.",
            }
          );
        }
      }
    );

    /* =================================================
       CLEAR PLAYLIST
    ================================================= */

    socket.on(
      "clearPlaylist",
      async ({
        roomCode,
      }) => {
        try {
          if (!roomCode) {
            return;
          }

          const code =
            roomCode
              .trim()
              .toUpperCase();

          const room =
            await Room.findOne({
              roomCode: code,
            });

          if (!room) {
            socket.emit(
              "roomError",
              {
                message:
                  "Room does not exist.",
              }
            );

            return;
          }

          const currentUserId =
            socket.data.userId;

          const isAdmin =
            room.adminId ===
            currentUserId;

          if (!isAdmin) {
            socket.emit(
              "adminError",
              {
                message:
                  "Only the room admin can clear the playlist.",
              }
            );

            return;
          }

          room.playlist = [];

          await room.save();

          io.to(code).emit(
            "playlistUpdated",
            []
          );

          console.log(
            `Playlist cleared in ${code}`
          );
        } catch (error) {
          console.error(
            "Clear playlist error:",
            error
          );

          socket.emit(
            "adminError",
            {
              message:
                "Could not clear playlist.",
            }
          );
        }
      }
    );

    /* =================================================
       DISCONNECT
    ================================================= */

    socket.on(
      "disconnect",
      () => {
        console.log(
          "User disconnected:",
          socket.id
        );

        const roomCode =
          socket.data.roomCode;

        if (!roomCode) {
          return;
        }

        /*
          Remove this tab/socket only.

          If another tab belonging to the
          same user is still open, the user
          remains visible online.
        */

        removeSocketFromRoom(
          roomCode,
          socket.id
        );

        io.to(
          roomCode
        ).emit(
          "roomUsers",
          getRoomUsers(
            roomCode
          )
        );
      }
    );
  }
);

/* =====================================================
   CONNECT DATABASE + START SERVER
===================================================== */

const PORT =
  process.env.PORT || 5000;

async function startServer() {
  try {
    if (
      !process.env.MONGODB_URI
    ) {
      throw new Error(
        "MONGODB_URI is missing from .env"
      );
    }

    await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log(
      "MongoDB connected successfully"
    );

    server.listen(
      PORT,
      () => {
        console.log(
          `Server running on port ${PORT}`
        );

        console.log(
          "Allowed frontend origins:",
          allowedOrigins
        );
      }
    );
  } catch (error) {
    console.error(
      "MongoDB connection error:",
      error.message
    );

    process.exit(1);
  }
}

startServer();
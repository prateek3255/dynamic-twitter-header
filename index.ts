import fs from "fs";
import Jimp from "jimp";
import qs from "qs";
import axios, { AxiosRequestConfig } from "axios";
import dotenv from "dotenv";
import truncate from "lodash/truncate";
import Parser from "rss-parser";

dotenv.config();

var parser = new Parser();

// ---------------
// Spotify stuff
// ---------------

async function getSpotifyAccessToken(): Promise<string> {
  const requestBody = qs.stringify({
    grant_type: "refresh_token",
    refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
  });

  const config: AxiosRequestConfig = {
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: requestBody,
  };

  const { data } = await axios(config);

  return data.access_token;
}

interface Track {
  name: string;
  cover: string;
  artist: string;
}

async function getRecentTracks(): Promise<Track[]> {
  const accessToken = await getSpotifyAccessToken();
  const recentlyPlayedTracks = await axios.get(
    `https://api.spotify.com/v1/me/player/recently-played?limit=3`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return recentlyPlayedTracks.data.items.map((item) => {
    const { name, artists } = item.track;
    const cover = item.track.album.images[0].url;
    const artist = artists[0].name;
    const nameWithoutBrackets = name.replace(/\(.*\)/, "").trim();
    const truncatedName = truncate(nameWithoutBrackets, {
      length: 30,
    });

    return { name: truncatedName, cover, artist };
  });
}

const TRACKS_COORDINATES = {
  cover: {
    x: 1990,
    y: 203,
  },
  name: {
    x: 2220,
    y: 222,
  },
  artist: {
    x: 2220,
    y: 312,
  },
  gap: 257,
};

// ---------------
// Blog stuff
// ---------------

async function getLatestArticle() {
  const articleData = await parser.parseURL(
    `https://prateeksurana.me/blog/feed.xml`
  );
  const latestArticle = articleData.items[articleData.items.length - 1];
  return { title: latestArticle.title, summary: latestArticle.summary };
}

async function processImage() {
  try {
    const cabinRegular56 = await Jimp.loadFont(
      "./fonts/cabin_regular_56/cabin-regular-56.ttf.fnt"
    );
    const cabinMedium56 = await Jimp.loadFont(
      "./fonts/cabin_medium_56/cabin-medium-56.ttf.fnt"
    );
    const cabinRegular48 = await Jimp.loadFont(
      "./fonts/cabin_regular_48/cabin-regular-48.ttf.fnt"
    );

    const [header, tracks, article] = await Promise.all([
      Jimp.read("./header.png"),
      getRecentTracks(),
      getLatestArticle(),
    ]);

    // --------------------
    // Spotify related stuff for printing the tracks
    // --------------------
    const allCovers = await Promise.all(
      tracks.map((track) => Jimp.read(track.cover))
    );

    tracks.forEach((track, index) => {
      const cover = allCovers[index];

      const resizedCover = cover.resize(200, 200);

      // This represents the gap between the position of the
      // current track and the starting position of the first track
      const currentGap = index * TRACKS_COORDINATES.gap;

      header.composite(
        resizedCover,
        TRACKS_COORDINATES.cover.x,
        TRACKS_COORDINATES.cover.y + currentGap
      );
      header.print(
        cabinRegular56,
        TRACKS_COORDINATES.name.x,
        TRACKS_COORDINATES.name.y + currentGap,
        track.name
      );
      header.print(
        cabinRegular48,
        TRACKS_COORDINATES.artist.x,
        TRACKS_COORDINATES.artist.y + currentGap,
        track.artist
      );
    });

    // --------------------
    // Blog related stuff for printing the latest article
    // --------------------
    header.print(cabinMedium56, 923, 223, article.title, 909);

    const titleHeight = Jimp.measureTextHeight(
      cabinMedium56,
      article.title,
      909
    );

    header.print(
      cabinRegular48,
      923,
      223 + titleHeight + 14,
      article.summary,
      909
    );

    header.write("result.png");
  } catch (e) {
    console.log(e);
  }
}

processImage();

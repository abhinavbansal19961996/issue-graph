import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
      }}
    >
      <svg width="115" height="115" viewBox="0 0 64 64" fill="none">
        <title>issue-graph mark</title>
        <path d="m19 17 27 15-27 15V17" stroke="white" strokeWidth="2.5" />
        <circle cx="19" cy="17" r="5" fill="white" />
        <circle cx="46" cy="32" r="5" fill="white" />
        <circle cx="19" cy="47" r="5" fill="white" />
      </svg>
    </div>,
    size,
  );
}

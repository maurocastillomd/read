import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "read.", description: "Your private EPUB library, clear explanations, visual flows, and notes across devices.", icons: {icon:"/favicon.svg",apple:"/apple-touch-icon.png"}, manifest:"/manifest.webmanifest", appleWebApp:{capable:true,title:"read.",statusBarStyle:"default"} };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>;}

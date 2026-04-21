import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThinkSpeed",
  description: "思考整理に特化した超軽量アウトライナー",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* テーマフラッシュ防止: ダークモード + カラー変数を初回描画前に適用 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{
  var d=document.documentElement;
  d.classList.toggle('dark',localStorage.getItem('thinkspeed-theme')==='dark');
  var lDef={bg:'#FAFAF8',text:'#374151',accent:'#6366f1',marker:'#818cf8'};
  var dDef={bg:'#1C1C1E',text:'#d1d5db',accent:'#818cf8',marker:'#6366f1'};
  function applyColors(c,prefix){d.style.setProperty('--ts-'+prefix+'-bg-main',c.bg);d.style.setProperty('--ts-'+prefix+'-text-color',c.text);d.style.setProperty('--ts-'+prefix+'-accent',c.accent);d.style.setProperty('--ts-'+prefix+'-marker',c.marker);}
  function loadColors(key,def){try{var r=localStorage.getItem(key);if(!r)return def;var p=JSON.parse(r);return{bg:p.bg||def.bg,text:p.text||def.text,accent:p.accent||def.accent,marker:p.marker||def.marker};}catch(e){return def;}}
  var lc=loadColors('thinkspeed-light-colors',lDef);
  var dc=loadColors('thinkspeed-dark-colors',dDef);
  applyColors(lc,'light');
  applyColors(dc,'dark');
  d.style.setProperty('--ts-marker',(d.classList.contains('dark')?dc:lc).marker);
}catch(e){}`
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

// Static asset imports resolve differently per bundler: Next.js yields
// StaticImageData ({ src, width, height }), plain webpack/vite a string.
// loader.tsx normalises with assetSrc().
declare module "*.webp" {
  const asset: string | { src: string };
  export default asset;
}
declare module "*.png" {
  const asset: string | { src: string };
  export default asset;
}

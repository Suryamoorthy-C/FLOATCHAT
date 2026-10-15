import { forwardRef } from "react";
import "./GlassSurface.css";

const asLength = (value) => (typeof value === "number" ? `${value}px` : value);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));

const GlassSurface = forwardRef(function GlassSurface(
  {
    as: Element = "div",
    width = 320,
    height = 76,
    borderRadius = 38,
    distortionScale = -180,
    displace = 0.5,
    backgroundOpacity = 0.1,
    borderWidth = 0.07,
    brightness = 50,
    opacity = 0.93,
    blur = 11,
    saturation = 1,
    redOffset = 0,
    greenOffset = 0,
    blueOffset = 0,
    refraction = false,
    renderer = "auto",
    shape,
    backdrop,
    className = "",
    style,
    children,
    ...props
  },
  forwardedRef,
) {
  const backdropUrl = typeof backdrop === "string"
    ? backdrop
    : backdrop?.current?.currentSrc || backdrop?.current?.src;
  const borderPixels = Number(borderWidth) <= 1
    ? Math.max(1, Number(borderWidth) * 16)
    : Number(borderWidth);
  const brightnessFactor = Number(brightness) > 4 ? Number(brightness) / 100 : Number(brightness);
  const mask = shape ? `url("${shape}")` : undefined;
  const surfaceStyle = {
    width: asLength(width),
    height: asLength(height),
    borderRadius: asLength(borderRadius),
    "--glass-border-width": `${borderPixels}px`,
    "--glass-background-opacity": String(clamp(backgroundOpacity)),
    "--glass-opacity": String(clamp(opacity)),
    "--glass-blur": `${Math.max(0, Number(blur) || 0)}px`,
    "--glass-brightness": String(Math.max(0, brightnessFactor || 1)),
    "--glass-saturation": String(Math.max(0, Number(saturation) || 1)),
    "--glass-shift-x": `${(Number(distortionScale) || 0) * (Number(displace) || 0) / 10}px`,
    "--glass-red-offset": `${Number(redOffset) || 0}px`,
    "--glass-green-offset": `${Number(greenOffset) || 0}px`,
    "--glass-blue-offset": `${Number(blueOffset) || 0}px`,
    "--glass-blue-offset-negative": `${-(Number(blueOffset) || 0)}px`,
    ...(backdropUrl ? { "--glass-backdrop-image": `url("${backdropUrl}")` } : {}),
    ...(mask ? { maskImage: mask, WebkitMaskImage: mask } : {}),
    ...style,
  };

  return (
    <Element
      {...props}
      ref={forwardedRef}
      className={`glass-surface${className ? ` ${className}` : ""}`}
      data-refraction={refraction ? "true" : "false"}
      data-renderer={renderer}
      data-has-shape={shape ? "true" : "false"}
      style={surfaceStyle}
    >
      {children}
    </Element>
  );
});

export default GlassSurface;

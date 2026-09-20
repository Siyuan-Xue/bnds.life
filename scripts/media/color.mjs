// Verified against the first iPhone Dolby Vision 8.4 / HLG source.
// Other HDR profiles stay explicit errors until representative footage is tested.
export function hdrToneMapFilter(video) {
  const dovi = video.side_data_list?.find((item) =>
    /DOVI/i.test(item.side_data_type ?? ""),
  );
  const hdr = ["arib-std-b67", "smpte2084"].includes(video.color_transfer);
  if (!hdr && !dovi) return null;
  const hlg =
    video.color_transfer === "arib-std-b67" &&
    video.color_primaries === "bt2020" &&
    video.color_space === "bt2020nc";
  const compatibleBase =
    !dovi ||
    (dovi.dv_profile === 8 &&
      dovi.dv_bl_signal_compatibility_id === 4 &&
      dovi.bl_present_flag === 1 &&
      dovi.el_present_flag === 0);
  if (!hlg || !compatibleBase)
    throw new Error("该 HDR/Dolby Vision 格式尚未验证色彩转换；原文件未修改");
  // Linear float RGB is required by tonemap. HLG uses a 1000-nit reference
  // display (peak 10 relative to the 100-nit SDR target). Clear stale HDR
  // frame side data after mapping, and explicitly tag the output as BT.709.
  return [
    "zscale=t=linear:npl=100",
    "format=gbrpf32le",
    "zscale=p=bt709",
    "tonemap=tonemap=mobius:param=0.3:desat=2:peak=10",
    "zscale=t=bt709:m=bt709:r=limited:dither=error_diffusion",
    "format=yuv420p",
    "sidedata=mode=delete",
  ].join(",");
}

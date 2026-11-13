// ===== 只需要改这里 =====
window.ADT = {
  // Meta Pixel ID（Events Manager 里那串数字）。留空 = 不追踪
  pixelId: "YOUR_PIXEL_ID",
  // Thank-you 页「WhatsApp 确认」发到这个号码（国家码 60，去掉开头的 0）
  bookingWhatsApp: "60182626442",
  // 可选时段（马来西亚时间，Zoom 45 分钟）。默认 10AM – 9PM，最后一场 8PM 开始
  timeSlots: ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"],
  // 显示接下来几个「开放日」
  daysAhead: 10,
  // 不开放的日子：0 = 星期日 ... 6 = 星期六。默认星期一到五开放
  closedWeekdays: [0, 6],
  // WhatsApp 拿 Case Study 链接
  whatsapp: "https://wa.link/48amhb"
};

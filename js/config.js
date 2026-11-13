// ===== 只需要改这里 =====
window.ADT = {
  // Meta Pixel ID（Events Manager 里那串数字）。留空 = 不追踪
  pixelId: "YOUR_PIXEL_ID",
  // 预约讯息发到这个 WhatsApp（国家码 60，去掉开头的 0）
  bookingWhatsApp: "60182626442",
  // 可选时段（马来西亚时间）
  timeSlots: ["10:00 AM", "11:30 AM", "2:00 PM", "3:30 PM", "5:00 PM", "8:00 PM", "9:00 PM"],
  // 显示接下来几天可选
  daysAhead: 8,
  // 哪几天不开放：0 = 星期日 ... 6 = 星期六。例如 [0] = 星期日休息
  closedWeekdays: [],
  // WhatsApp 拿 Case Study 链接
  whatsapp: "https://wa.link/48amhb"
};

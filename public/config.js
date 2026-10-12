// Content that is still to be filled in. Empty strings render as placeholders.
window.SITE = {
  links: {
    whatsapp: '',        // WhatsApp group invite link
    luma: '',            // Luma calendar link
    valentinaBooking: '' // Valentina Heights booking link
  },
  // Drop files in public/media/ and put their paths here, e.g. '/media/hero-1.jpg'
  images: {
    hero: ['media/hero-1.webp'], // photos for the left carousel (arrows show when there is more than one)
    slope: 'media/slope.jpg', // small photo box in the hero
    // Full-screen photo reel. fit: 'cover' (landscape), 'portrait' (tall photo, blurred sides on wide screens),
    // 'inset' (small or low-resolution image shown as a framed poster).
    bansko: [
      { src: 'media/bansko-1.jpg', alt: 'Bansko old town and the Pirin mountains under fresh snow', fit: 'cover' },
      { src: 'media/bansko-2.jpg', alt: 'A snowy old town street with the mountains behind', fit: 'cover' },
      { src: 'media/bansko-3.jpg', alt: 'Skiers on a slope between snowy pine forests', fit: 'portrait' },
      { src: 'media/bansko-4.jpg', alt: 'A painted gondola above a ski village', fit: 'portrait' },
      { src: 'media/bansko-5.jpg', alt: 'Illustrated ski map of Bansko', fit: 'inset' }
    ],
    snow: '',            // snow & ski tracks
    closing: []          // 3 photos
  },
  videoUrl: ''           // Ting's video invitation, e.g. '/media/invite.mp4'
};

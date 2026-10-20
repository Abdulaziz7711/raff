// Wording and status icons, carried over from the original single-page version
export const KINDS = {
  games:{name:'الألعاب',done:'خلصتها',played:'لعبتها',dropped:'تركتها',playing:'ألعبها الحين',paused:'موقّفها',wish:'ناوي ألعبها',list:'قائمة الأمنيات',short:'الأمنيات',back:'موقّفها، ترجع لها',total:'لعبتها',unit:'لعبة',best:'ألعاب'},
  movies:{name:'الأفلام',done:'شفته',played:'شفت منه',dropped:'تركته',playing:'أشوفه الحين',paused:'وقفته',wish:'أبي أشوفه',list:'قائمة المشاهدة',short:'للمشاهدة',back:'وقفتها، ترجع لها',total:'شفتها',unit:'فيلم',best:'أفلام'},
  shows:{name:'المسلسلات والأنمي',done:'خلصته',played:'تابعت منه',dropped:'تركته',playing:'أتابعه الحين',paused:'وقفته',wish:'أبي أتابعه',list:'قائمة المشاهدة',short:'للمشاهدة',back:'وقفتها، ترجع لها',total:'خلصتها',unit:'عمل',best:'مسلسلات وأنمي'}
};
export const STATUSES = ['done','played','playing','paused','dropped','wish'];
export const SICON = {
  done:{c:'#2fbf5b', svg:'<path d="M7 9h10a4 4 0 0 1 4 4v1.5a2.5 2.5 0 0 1-4.6 1.4L15 14H9l-1.4 1.9A2.5 2.5 0 0 1 3 14.5V13a4 4 0 0 1 4-4z"/><path d="M7.5 11.2v2.6M6.2 12.5h2.6"/><circle cx="15.5" cy="12" r=".6"/><circle cx="17" cy="13.4" r=".6"/>'},
  played:{c:'#e5484d', svg:'<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4 15.6a1.6 1.6 0 0 1 2.4-2.1L8 15"/>'},
  dropped:{c:'#8a94a3', svg:'<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/><path d="M12 7.5l3.2 1.3 1.3 3.2-1.3 3.2-3.2 1.3-3.2-1.3L7.5 12l1.3-3.2z"/><path d="M12 4.8l5.1 2.1 2.1 5.1-2.1 5.1-5.1 2.1-5.1-2.1L4.8 12l2.1-5.1z"/>'}
};
export const badge = s => SICON[s] ? `<i class="sb" style="--sc:${SICON[s].c}" title="${s}"><svg viewBox="0 0 24 24">${SICON[s].svg}</svg></i>` : '';

// how a status reads on someone else's profile
export const OTHER = {
  games:{done:'خلّصها',played:'لعبها',dropped:'تركها',playing:'يلعبها الحين',paused:'موقّفها',wish:'ناوي يلعبها'},
  movies:{done:'شافه',played:'شاف منه',dropped:'تركه',playing:'يشوفه الحين',paused:'موقّفه',wish:'يبي يشوفه'},
  shows:{done:'خلّصه',played:'تابع منه',dropped:'تركه',playing:'يتابعه الحين',paused:'موقّفه',wish:'يبي يتابعه'}
};
export const label = (kind, status, mine = true) => (mine ? KINDS[kind] : OTHER[kind])[status] || '';
export const KIND_NAME = {games:'ألعاب', movies:'أفلام', shows:'مسلسلات وأنمي'};
export const KIND_ONE = {games:'لعبة', movies:'فيلم', shows:'مسلسل / أنمي'};

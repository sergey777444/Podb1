/* Журналы по предметам. Чтобы добавить предмет — скопируйте блок {...} и поправьте.
   url      — обычная ссылка на Google-таблицу (нужна нужная вкладка: в ссылке есть gid=...)
   embed    — необязательно: ссылка из «Файл → Опубликовать в интернете → Встроить» (если обычная не показывается)
   type      — 'sheet' (по умолчанию, Google-таблица в окне), 'image' (картинка с Яндекс.Диска), 'link' (просто кнопка-ссылка: Moodle, Яндекс.Документы)
   adminOnly — true: предмет видят только админы (кураторы)
   Таблица должна быть открыта «всем, у кого есть ссылка: просмотр». */
window.JOURNALS = [
  {
    id: 'tmk', icon: '🌍', title: 'ТМК',
    full: 'Теория межкультурной коммуникации · ПОДб-11',
    url: 'https://docs.google.com/spreadsheets/d/1gJxgmR3eAT7JKLMB26nX-ObzHQXkHJW6hMouXgFJi24/edit?gid=287002214',
    embed: '',
    adminOnly: false
  },
  { id: 'j2', type: 'image', icon: '🖼️', title: 'Журнал 2', full: 'Яндекс.Диск · картинка', url: 'https://disk.yandex.ru/i/MDLnf1Esxjgk2A', adminOnly: false },
  { id: 'j3', type: 'image', icon: '🖼️', title: 'Журнал 3', full: 'Яндекс.Диск · картинка', url: 'https://disk.yandex.ru/i/KUASlO-sN3dczA', adminOnly: false },
  { id: 'j4', type: 'link', icon: '🎓', title: 'Журнал 4', full: 'Moodle', url: 'https://moodle.uio.csu.ru/mod/resource/view.php?id=225932', adminOnly: false },
  { id: 'j5', type: 'link', icon: '📄', title: 'Журнал 5', full: 'Яндекс.Документы', url: 'https://docs.yandex.ru/view/d/dYyvirEm8ssXJnqpsjvXlyPegnqahzm72s0qoIz-cKg6WGJrOGVoMndlQQ', adminOnly: false }
  /* ,{ id: 'eng', icon: '🇬🇧', title: 'Английский', full: '...', url: '...', embed: '', adminOnly: false } */
];

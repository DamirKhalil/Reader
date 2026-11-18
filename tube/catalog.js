/* Каталог «Чернил».
   Чтобы добавить видео, допишите объект в VIDEOS:
   id      — идентификатор ролика YouTube (часть ссылки после v=)
   type    — "interview" | "lecture" | "analysis"
   writer  — о ком видео (по этому полю строится раздел «Авторы»)
   lang    — "ru" | "en"
   year    — год записи, если известен (необязательно)
   series  — название цикла, если ролик из серии (необязательно)
   note    — одна-две фразы, зачем смотреть
   Чтобы добавить курс (плейлист YouTube), допишите объект в COURSES. */

window.CATALOG = {
  VIDEOS: [
    /* ── Интервью ─────────────────────────────────────────── */
    { id: "V8OwyqvSh2g", type: "interview", writer: "Владимир Набоков", lang: "en", year: 1965,
      title: "Набоков в Монтрё", by: "Роберт Хьюз",
      note: "Набоков отвечает по заранее написанным карточкам и не скрывает этого. Хорошо видно, как он строит фразу." },
    { id: "FGXzJJF0WW4", type: "interview", writer: "Владимир Набоков", lang: "ru", year: 1974,
      title: "Владимир Набоков: интервью в Монтрё", by: "Швейцарское телевидение",
      note: "Поздний Набоков о языке, переводе и о том, что он считает в прозе главным." },
    { id: "NhTT8pqNAMg", type: "interview", writer: "Иосиф Бродский", lang: "ru",
      title: "Иосиф Бродский. Интервью в Нью-Йорке",
      note: "Разговор в эмиграции, перемежается кадрами из Петербурга." },
    { id: "P8GhGhPgM4o", type: "interview", writer: "Иосиф Бродский", lang: "ru",
      title: "Разговор с небожителем", note: "Длинная беседа без спешки, с отступлениями. Около 44 минут." },
    { id: "XYn3HFg_T0o", type: "interview", writer: "Майя Энджелоу", lang: "en", series: "Paris Review × 92Y",
      title: "Maya Angelou with George Plimpton", by: "Джордж Плимптон",
      note: "Энджелоу о своём распорядке: гостиничный номер, жёлтые блокноты, работа с утра." },
    { id: "YhCTWqwEbgg", type: "interview", writer: "Пол Теру", lang: "en", series: "Paris Review × 92Y",
      title: "Paul Theroux with George Plimpton", by: "Джордж Плимптон",
      note: "Травелог как литература: как из поездки получается книга." },
    { id: "iMHVQffrMYY", type: "interview", writer: "Чеслав Милош", lang: "en", series: "Paris Review × 92Y",
      title: "Czesław Miłosz with Robert Faggen", by: "Роберт Фэгген",
      note: "Нобелевский лауреат о поэзии, памяти и жизни между языками." },
    { id: "tvj-pV_6_10", type: "interview", writer: "Рышард Капущинский", lang: "en", series: "Paris Review × 92Y",
      title: "Ryszard Kapuściński", by: "Скотт Малкомсон",
      note: "Где проходит граница между репортажем и художественной прозой." },
    { id: "KOFYRZmlPrU", type: "interview", writer: "Дениз Левертов", lang: "en", series: "Paris Review × 92Y",
      title: "Denise Levertov with Deborah Digges", by: "Дебора Диггес",
      note: "Поэтесса о ритме, строке и о том, как стихотворение находит форму." },
    { id: "l50ElZC_bK8", type: "interview", writer: "Тони Моррисон", lang: "en", year: 1978,
      title: "Toni Morrison: The Classic 1978 Interview",
      note: "Ранняя Моррисон читает отрывки из первых романов и объясняет, зачем пишет." },
    { id: "C-SGXvk_bak", type: "interview", writer: "Тони Моррисон", lang: "en", year: 1987,
      title: "Toni Morrison on writing «Beloved»",
      note: "Как из газетной заметки XIX века вырос роман." },
    { id: "eSLbTtMiEzY", type: "interview", writer: "Тони Моррисон", lang: "en", year: 1998,
      title: "Toni Morrison on «The Bluest Eye» and «Paradise»",
      note: "О трудности писать о расе так, чтобы текст не превращался в лозунг." },
    { id: "-dDM9rRtNIA", type: "interview", writer: "Анни Эрно", lang: "en", series: "Advice to the Young",
      title: "Annie Ernaux: Advice to the Young", by: "Louisiana Channel",
      note: "Нобелевский лауреат — коротко о том, что сказала бы начинающему автору." },
    { id: "zBNm1E-yOHc", type: "interview", writer: "Воле Шойинка", lang: "en", series: "Advice to the Young",
      title: "Wole Soyinka: Advice to the Young", by: "Louisiana Channel",
      note: "«Собирайте отказы из редакций в ящик стола и продолжайте писать»." },
    { id: "9uFxctylO8o", type: "interview", writer: "Клэр-Луиз Беннетт", lang: "en", series: "Advice to the Young",
      title: "Claire-Louise Bennett's Advice to the Young", by: "Louisiana Channel",
      note: "Найдите, что странного в вашем письме и в вас самих, и копайте туда." },
    { id: "iW-ekpRn5Ts", type: "interview", writer: "Тесса Хэдли", lang: "en", series: "Advice to the Young",
      title: "Tessa Hadley: Advice to the Young", by: "Louisiana Channel",
      note: "О рабочем процессе и о том, как не бросить первый роман." },
    { id: "X2InJc_-x-8", type: "interview", writer: "Бен Лернер", lang: "en", series: "Advice to the Young",
      title: "How To Be a Good Writer", by: "Louisiana Channel",
      note: "Чтобы хорошо писать, сначала научитесь хорошо читать — и идите за авторами, которых любите." },
    { id: "d-6CmLURKc8", type: "interview", writer: "Брет Истон Эллис", lang: "en", series: "Advice to the Young",
      title: "Bret Easton Ellis Shares Advice to Aspiring Writers", by: "Louisiana Channel",
      note: "Совет молодым — с улыбкой и без иллюзий насчёт профессии." },

    /* ── Мастер-классы и лекции ───────────────────────────── */
    { id: "jrIogch5DBU", type: "lecture", writer: "Брэндон Сандерсон", lang: "en", year: 2020, series: "Курс BYU",
      title: "Lecture #2: Plot, Part 1", note: "Сюжет как набор обещаний читателю и того, как их выполнять." },
    { id: "Qgbsz7Gnrd8", type: "lecture", writer: "Брэндон Сандерсон", lang: "en", year: 2020, series: "Курс BYU",
      title: "Lecture #3: Plot, Part 2", note: "Продолжение про сюжет: прогресс, напряжение, развязка." },
    { id: "zVXFNw-xz3Y", type: "lecture", writer: "Брэндон Сандерсон", lang: "en", year: 2020, series: "Курс BYU",
      title: "Lecture #4: Viewpoint and Q&A", note: "Точка зрения: от первого лица, третье близкое, всезнающий рассказчик." },
    { id: "ATNvOk5rIJA", type: "lecture", writer: "Брэндон Сандерсон", lang: "en", year: 2020, series: "Курс BYU",
      title: "Lecture #5: Worldbuilding, Part 1", note: "Как строить мир, не утопив читателя в справочнике." },
    { id: "V2KpWOLTXx8", type: "lecture", writer: "Брэндон Сандерсон", lang: "en", year: 2020, series: "Курс BYU",
      title: "Lecture #6: Worldbuilding, Part 2", note: "Культура, экономика, магические системы." },
    { id: "1NCiuI6F5O0", type: "lecture", writer: "Брэндон Сандерсон", lang: "en", year: 2020, series: "Курс BYU",
      title: "Lecture #9: Characters", note: "Три шкалы персонажа: симпатия, активность, компетентность." },
    { id: "tHdYX418PaA", type: "lecture", writer: "Брэндон Сандерсон", lang: "en", year: 2020, series: "Курс BYU",
      title: "Lecture #13: Publishing, Part 2", note: "Агенты, издательства, самиздат — практическая часть." },
    { id: "oP3c1h8v2ZQ", type: "lecture", writer: "Курт Воннегут", lang: "en",
      title: "Kurt Vonnegut on the Shapes of Stories",
      note: "Знаменитые графики: ось удачи героя и ось времени. Десять минут, которые меняют взгляд на сюжет." },
    { id: "X4C0qpYxnCM", type: "lecture", writer: "Галина Юзефович", lang: "ru",
      title: "Плоский культурный мир: распад канона и новая роль критики",
      note: "Открытая лекция в РЭШ: почему иерархия «высокого» и «низкого» больше не работает." },
    { id: "L3qAJCyh7nw", type: "lecture", writer: "Галина Юзефович", lang: "ru",
      title: "Как полюбить читать", note: "Критик о чтении как навыке, который можно вернуть." },
    { id: "mMWpgQjtnbU", type: "lecture", writer: "Юрий Лотман", lang: "ru", series: "Беседы о русской культуре",
      title: "Беседы о русской культуре. Культура и интеллигентность",
      note: "Лотман говорит с камерой так, будто перед ним один внимательный слушатель." },
    { id: "9FSYo4ol0nw", type: "lecture", writer: "Юрий Лотман", lang: "ru", series: "Беседы о русской культуре",
      title: "Беседы о русской культуре. Культура и патриотизм", note: "Четвёртая беседа короткого цикла." },

    /* ── Разборы ──────────────────────────────────────────── */
    { id: "4NkGa1Er_VU", type: "analysis", writer: "Иосиф Бродский", lang: "ru",
      title: "Поэт о поэтах", note: "Бродский разбирает великих русских поэтов: кто, за что и почему." },
    { id: "9e_siVIZZ2E", type: "analysis", writer: "Юрий Лотман", lang: "ru", series: "Беседы о русской культуре",
      title: "Пушкин, Александр I и декабристы", note: "Биография как ключ к текстам: Лотман читает жизнь Пушкина." },
    { id: "dLB4TtqgsO4", type: "analysis", writer: "Галина Юзефович", lang: "ru", by: "«Полка»",
      title: "Галина Юзефович о классике", note: "Зачем сегодня перечитывать классику и как не бояться её." },
    { id: "TFmmtYjpFU4", type: "analysis", writer: "Галина Юзефович", lang: "ru",
      title: "Главные книги современной литературы", note: "Обзор: что из нового уже стоит считать важным." }
  ],

  COURSES: [
    { list: "PLA3ZfaJiaf5xCQwC1c5sguPR1vmzT6Yiw", cover: "jrIogch5DBU", writer: "Брэндон Сандерсон", lang: "en", year: 2020,
      title: "Как писать фантастику и фэнтези", note: "Полный семестровый курс в Университете Бригама Янга: сюжет, персонажи, миры, издание." },
    { list: "PL40OiiJw6-gd4WWUG7HOJWGSwiPnkeMKZ", cover: "mMWpgQjtnbU", writer: "Юрий Лотман", lang: "ru",
      title: "Беседы о русской культуре", note: "Телецикл о быте и традициях русского дворянства — фон, без которого не понять классику." },
    { list: "PLFfHPVoMQkB5-UovlcVFl5MNgQB00MOJ2", writer: "Галина Юзефович", lang: "ru",
      title: "Предисловие", note: "Подкаст о чтении: Юзефович и учитель литературы Александр Серапионов." }
  ]
};

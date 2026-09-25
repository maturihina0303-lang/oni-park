-- One-time update of the existing ideas requested by the owner.
UPDATE ideas SET author = 'ひなこ', theme = CASE
 WHEN title IN ('巨大クモの巣鬼ごっこ','おもちゃ工場鬼ごっこ','深海水族館鬼ごっこ','夢を食べるバク鬼ごっこ','異次元ホテル鬼ごっこ','呪われた映画館鬼ごっこ','巨人の料理教室鬼ごっこ','動き出す影鬼ごっこ') THEN 'オリジナルホラー'
 ELSE 'その他' END;

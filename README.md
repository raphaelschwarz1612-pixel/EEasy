# EEasy

A free web app for young adults (18–19) to learn B1–B2 English vocabulary.
It works on any phone, tablet or laptop in the browser. No app store needed.

- **Overview**: words known, quiz average, day streak, XP, progress per topic, word of the day, leaderboard
- **Flashcards**: tap to flip, then choose "I know it" or "Still learning"
- **Quiz**: 10 short questions (meanings, gap sentences, German → English)
- **Word list**: search all 140 words in English or German
- **Accounts**: everyone signs up with their own email and password, and their progress is saved online

Topics: Travel, School & Uni, Work & Jobs, Tech & Social Media, Health & Sport, Environment, Everyday Life & Feelings (20 words each).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page itself |
| `css/style.css` | Colours and layout |
| `js/vocab.js` | All the words. Add or change words here. |
| `js/app.js` | Flashcards, quiz, word list and overview |
| `js/store.js` | Accounts and saving progress |
| `js/config.js` | Your Supabase keys go here |
| `supabase/setup.sql` | Creates the database table (run once) |

Until you add Supabase keys, the app runs in **demo mode**: it works, but progress is only saved on that one device and there are no accounts.

---

## Step 1: Turn on accounts with Supabase (free)

Supabase stores the accounts and everyone's progress.

1. Go to <https://supabase.com>, sign up, and click **New project**. Pick any name (e.g. `eeasy`), set a database password, choose region **Central EU (Frankfurt)**, and create it. Wait about a minute.
2. In the left menu open **SQL Editor** → **New query**. Copy everything from `supabase/setup.sql`, paste it in, and click **Run**. You should see "Success".
3. Open **Authentication** → **Sign In / Providers** → **Email**.
   - For a class or testing it's easiest to switch **Confirm email** off, so people can sign in right after signing up.
   - If you leave it on, people must click a link in an email first (Supabase's free email sending is limited to a few emails per hour).
4. Open **Project Settings** → **API** (sometimes called **Data API** / **API Keys**). Copy the **Project URL** and the **anon public** key.
5. Open `js/config.js` in a text editor (e.g. Notepad or VS Code) and paste them in:

   ```js
   window.APP_CONFIG = {
     supabaseUrl: 'https://abcdefghijkl.supabase.co',
     supabaseAnonKey: 'eyJhbGciOi...'
   };
   ```

   The anon key is safe to publish. The rules from `setup.sql` make sure nobody can change someone else's progress. **Never** paste the `service_role` key here.

## Step 2: Put the folder on GitHub with GitHub Desktop

1. Open **GitHub Desktop** and sign in with your GitHub account.
2. Click **File → Add local repository…** and choose this `EEasy` folder.
3. It will say the folder is not a Git repository yet. Click **create a repository**, keep the name `EEasy`, and click **Create repository**.
4. Click **Publish repository** (top bar).
   - **Untick "Keep this code private"**. A free GitHub account can only publish public projects as a website.
   - Click **Publish repository**.

## Step 3: Turn the project into a website (GitHub Pages)

1. In GitHub Desktop click **Repository → View on GitHub**. Your browser opens the project.
2. Click **Settings** (top of the project) → **Pages** (left menu).
3. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
4. Under **Branch** choose **main** and **/ (root)**, then click **Save**.
5. Wait 1–2 minutes and refresh. GitHub shows your web address at the top, for example:

   **`https://YOUR-GITHUB-NAME.github.io/EEasy/`**

Open that address on any phone. Tip: in the phone browser choose **Share → Add to Home Screen** so it looks like an app.

## Step 4: Tell Supabase your web address

So confirmation emails link back to your app:

1. In Supabase open **Authentication** → **URL Configuration**.
2. Set **Site URL** to your GitHub Pages address from Step 3 and click **Save**.

## Changing the app later

1. Edit a file (for example add words in `js/vocab.js`).
2. In GitHub Desktop write a short summary (e.g. "Add new travel words") and click **Commit to main**.
3. Click **Push origin**. The website updates after about a minute.

## Adding words

Each word in `js/vocab.js` is one line:

```js
['word', 'part of speech', 'definition in easy English', 'German', 'Example sentence that contains the word.'],
```

Keep the word exactly as written inside the example sentence, so the quiz can turn it into a gap.
To add a new topic, add it to `window.TOPICS` and add a matching list in `RAW` with the same `id`.

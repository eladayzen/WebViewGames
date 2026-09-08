# Two requests for `GoBalance/WebGames`

From the Hill Bomb: Sunset Ridge build. Both are in `WebGameSaveStore.cs` and
`WebGameBridge.cs`, and neither needs a schema change, a new collection or an
index.

Filed rather than worked around, per the folder's own README.

---

## 1. An optional board id on `submitScore` / `getScoreboard`

```js
await GoBalance.submitScore(value, boardId?)
await GoBalance.getScoreboard(boardId?)
```

Omitted, both behave exactly as today. Nothing existing changes.

### Why we need it

Hill Bomb has two things worth ranking that cannot share a number: a **twenty
mission ladder**, where a score only means something next to the same mission,
and a **speed race** across six tracks. One board per game forces us to pick
one and drop the other — and a single ranked number genuinely does not describe
a twenty-mission ladder.

We are shipping the race board and holding the per-mission boards until this
exists. Per-mission *personal* bests are going in our own save blob in the
meantime, which works but can only ever be personal: a sibling's blob is not
ours to read, so the family comparison — the thing that actually makes a board
worth looking at in a family app — is the part that needs the API.

### Why it is a small change

**The sibling read already exists and already works.** `CollectBoard` walks
every profile document on the account and reads `_gameKey` from each:

```csharp
foreach (DocumentSnapshot profileDoc in profiles.Documents)
{
    profileDoc.Reference
        .Collection(...ProfileSaveDataLogCol.name)
        .Document(_gameKey)
        .GetSnapshotAsync()
        ...
}
```

So this is not a permissions question and not a data-modelling question. The
access is routine, the documents are already enumerated, and the runs are
already there.

**And the scores are a FIELD, not a document.** `SubmitScore` writes
`{ ScoreField, runs.ToArray() }` with `SetOptions.MergeAll` onto the same
per-game document that holds `WebState`:

```csharp
private const string ScoreField = "Score";
var fields = new Dictionary<string, object> { { ScoreField, runs.ToArray() } };
docRef.SetAsync(fields, SetOptions.MergeAll).ContinueWithOnMainThread(...);
```

Which means a board id can be **another field on the document already being
read** — `Score` when omitted, `Score_<boardId>` when given. No new document,
no new collection, no index, no change to
`FirestoreStructureStrings.WebGameKey()`, and `MergeAll` already guarantees one
board cannot disturb another or disturb `WebState`.

The same substitution covers the PlayerPrefs mirror, which is keyed on
`_gameKey` in one place (`WEB_GAME_SAVE_PREFIX + _gameKey + ":" + ProfileId()`).

A sanity bound on ids would be reasonable — `[A-Za-z0-9_]{1,24}`, rejected at
the bridge the way a non-integer score already is — so a game cannot invent
unbounded fields on a shared document.

---

## 2. `SubmitScore` should resolve from the `SetAsync` continuation

Today it resolves before the write commits, and always reports success:

```csharp
docRef.SetAsync(fields, SetOptions.MergeAll).ContinueWithOnMainThread(task =>
{
    if (task.IsFaulted || task.IsCanceled)
        Debug.LogWarning("[WebGameSaveStore] score upload failed for '" + _gameKey + "'.");
});

done(true);          // <- fires immediately, regardless of the task
```

`done` is wired straight to the JS promise:

```csharp
_saveStore.SubmitScore(value, ok => Resolve(id, ok, "{\"submitted\":" + ... + "}"));
```

So `await GoBalance.submitScore(n)` resolves `true` while the write is still in
flight, and a `getScoreboard()` fired the moment it resolves can legitimately
come back without that run. It is intermittent by nature, which is the worst
version of it — it passes in the Editor and on a fast connection, and shows up
as "the run I just played is missing" in front of a player.

`done(true)` also reports success on a genuinely failed upload. The warning is
logged where nobody sees it and the page is told everything is fine.

Moving `done` into the continuation, passing the task's real result, makes
`await submitScore()` mean "the write landed" — which is what a caller
reasonably assumes it already means, and what makes the obvious
submit-then-fetch sequence correct instead of a race.

The local copy is written before this point either way, so the offline and
PlayerPrefs paths are unaffected.

---

## Not asked for

Worth saying explicitly so it does not get read into the above: we are **not**
asking for a global cross-account board. The README is clear that it needs
shared collections and write rules that do not exist, and nothing we are
building assumes one.

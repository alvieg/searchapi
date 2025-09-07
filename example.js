import DuckSearch from "ducksearch";

const ddg = DuckSearch({ delay: 500, safeSearch: true });

(async () => {
  // 1️⃣ Text search
  const results = await ddg.text("OpenAI GPT-5", 2, 10);
  console.log("Text results:", results);

  // 2️⃣ Instant answer
  const instant = await ddg.instant("What is Node.js?");
  console.log("Instant answer:", instant);

  // 3️⃣ Wikipedia summary
  const wikiPage = await ddg.wiki("Node.js");
  console.log("Wikipedia page:", wikiPage);

  // 4️⃣ Image search
  const images = await ddg.images("Node.js logo", 5);
  console.log("Images:", images);
})();

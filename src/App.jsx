
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "./App.css";

const BASE_URL = "https://www.themealdb.com/api/json/v1/1";
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

const CHART_COLORS = [
  "#267d54",
  "#75ad83",
  "#a8cdb0",
  "#438b65",
  "#8ab99a",
  "#d8b66a",
  "#6a9fbb",
  "#c58a70",
  "#9b91c7",
  "#70b8b1",
];

async function fetchMeals(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("TheMealDB request failed.");
  }

  const data = await response.json();
  return data.meals || [];
}

function App() {
  const [catalogue, setCatalogue] = useState([]);
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState([]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const [selectedMeal, setSelectedMeal] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState("");

  // Load meal categories, cuisines, and the meal catalogue.
  useEffect(() => {
    let cancelled = false;

    async function loadCatalogue() {
      setLoading(true);
      setError("");

      try {
        const [categoryOptions, areaOptions] = await Promise.all([
          fetchMeals(`${BASE_URL}/list.php?c=list`),
          fetchMeals(`${BASE_URL}/list.php?a=list`),
        ]);

        if (cancelled) return;

        setCategories(categoryOptions);
        setAreas(areaOptions);

        const mealsById = new Map();

        // Fetch meals in batches instead of sending 26 requests at once.
        for (let i = 0; i < LETTERS.length; i += 4) {
          const batch = LETTERS.slice(i, i + 4);

          const responses = await Promise.all(
            batch.map((letter) =>
              fetchMeals(`${BASE_URL}/search.php?f=${letter}`)
            )
          );

          if (cancelled) return;

          responses.flat().forEach((meal) => {
            if (meal.idMeal) {
              mealsById.set(meal.idMeal, meal);
            }
          });
        }

        if (!cancelled) {
          setCatalogue([...mealsById.values()]);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Could not load the meal catalogue. Check your connection and retry."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCatalogue();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  // Filter meals and exclude the Miscellaneous category.
  const filteredMeals = useMemo(() => {
  const term = search.trim().toLowerCase();

  return catalogue.filter((meal) => {
    // Exclude Miscellaneous meals
    if (meal.strCategory === "Miscellaneous") {
      return false;
    }

    const mealName = (meal.strMeal || "").toLowerCase();
    const mealCategory = (meal.strCategory || "").toLowerCase();
    const mealArea = (meal.strArea || "").toLowerCase();

    // If the user searches for vegetarian,
    // show meals from the Vegetarian category.
    const matchesSearch =
      !term ||
      (term === "vegetarian"
        ? mealCategory === "vegetarian"
        : mealName.includes(term));

    const matchesCategory =
      !category || meal.strCategory === category;

    const matchesArea =
      !area || meal.strArea === area;

    return matchesSearch && matchesCategory && matchesArea;
  });
    }, [catalogue, search, category, area]);

  // Count meals in each category for the charts.
  const categoryData = useMemo(() => {
    const counts = {};

    filteredMeals.forEach((meal) => {
      const name = meal.strCategory || "Unknown";

      if (name === "Miscellaneous") {
        return;
      }

      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredMeals]);

  // Count unique cuisines represented in the current results.
  const cuisineCount = useMemo(
    () =>
      new Set(
        filteredMeals
          .map((meal) => meal.strArea)
          .filter(Boolean)
      ).size,
    [filteredMeals]
  );

  // Fetch full recipe details when a meal card is selected.
  async function openRecipe(mealId) {
    setSelectedMeal(null);
    setRecipeError("");
    setRecipeLoading(true);

    try {
      const response = await fetch(
        `${BASE_URL}/lookup.php?i=${mealId}`
      );

      if (!response.ok) {
        throw new Error("Could not load recipe.");
      }

      const data = await response.json();
      const meal = data.meals?.[0];

      if (!meal) {
        throw new Error("Recipe not found.");
      }

      setSelectedMeal(meal);
    } catch {
      setRecipeError(
        "Unable to load this recipe. Please try again."
      );
    } finally {
      setRecipeLoading(false);
    }
  }

  function closeRecipe() {
    setSelectedMeal(null);
    setRecipeError("");
  }

  function resetFilters() {
    setSearch("");
    setCategory("");
    setArea("");
  }

  function retryLoading() {
    setRetryCount((count) => count + 1);
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <p className="eyebrow" aria-label="Meal Analytics logo">
          FOOD DATA EXPLORER
        </p>

        <h1>Meal Analytics</h1>
        <p>Explore meals from around the world</p>

        <span className="powered-by">
          Powered by TheMealDB
        </span>
      </header>

      <form
        className="search-bar"
        onSubmit={(event) => event.preventDefault()}
      >
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>

        <input
          type="search"
          placeholder="Search meals by name..."
          aria-label="Search meals by name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <button type="submit">Search</button>
      </form>

      <section
        className="filter-controls"
        aria-label="Meal filters"
      >
        <label className="filter-field">
          <span>Category</span>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>

            {categories
              .filter(
                (item) => item.strCategory !== "Miscellaneous"
              )
              .map((item) => (
                <option
                  key={item.strCategory}
                  value={item.strCategory}
                >
                  {item.strCategory}
                </option>
              ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Cuisine</span>

          <select
            value={area}
            onChange={(event) => setArea(event.target.value)}
          >
            <option value="">All cuisines</option>

            {areas.map((item) => (
              <option
                key={item.strArea}
                value={item.strArea}
              >
                {item.strArea}
              </option>
            ))}
          </select>
        </label>

        <button
          className="reset-button"
          type="button"
          onClick={resetFilters}
        >
          Reset filters
        </button>
      </section>

      {loading && (
        <div className="status" role="status">
          Loading meals from TheMealDB. The first load may take
          a little time…
        </div>
      )}

      {error && (
        <div className="status" role="alert">
          <p>{error}</p>
          <button type="button" onClick={retryLoading}>
            Retry
          </button>
        </div>
      )}

      <section className="stats">
        <article className="stat-card">
          <span>Meals found</span>
          <h2>{loading ? "…" : filteredMeals.length}</h2>
          <p>Matching the current search and filters</p>
        </article>

        <article className="stat-card">
          <span>Categories represented</span>
          <h2>{loading ? "…" : categoryData.length}</h2>
          <p>In the current results</p>
        </article>

        <article className="stat-card">
          <span>Cuisines represented</span>
          <h2>{loading ? "…" : cuisineCount}</h2>
          <p>In the current results</p>
        </article>
      </section>

      <section className="charts-grid">
        <article className="chart-card">
          <h2>Meals by Category</h2>
          <p>Number of meals in each category</p>

          <div className="chart-container">
            {!loading && categoryData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  margin={{
                    top: 10,
                    right: 12,
                    left: -15,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e4eee6"
                  />

                  <XAxis
                    dataKey="name"
                    tick={{
                      fill: "#62786a",
                      fontSize: 12,
                    }}
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fill: "#62786a",
                      fontSize: 12,
                    }}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="count"
                    name="Meals"
                    fill="#267d54"
                    radius={[7, 7, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="chart-card">
          <h2>Category Distribution</h2>
          <p>Share of matching meals by category</p>

          <div className="chart-container">
            {!loading && categoryData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius="68%"
                    paddingAngle={2}
                  >
                    {categoryData.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={
                          CHART_COLORS[
                            index % CHART_COLORS.length
                          ]
                        }
                      />
                    ))}
                  </Pie>

                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="data-section">
        <div className="section-heading">
          <h2>Explore Meals</h2>

          {!loading && (
            <span>{filteredMeals.length} results</span>
          )}
        </div>

        {!loading && !error && filteredMeals.length === 0 ? (
          <div className="status">
            <h3>No meals found</h3>
            <p>
              Try another search term or change your filters.
            </p>

            <button type="button" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="meal-grid">
            {filteredMeals.map((meal) => (
              <article
                className="meal-card"
                key={meal.idMeal}
                role="button"
                tabIndex={0}
                onClick={() => openRecipe(meal.idMeal)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    event.preventDefault();
                    openRecipe(meal.idMeal);
                  }
                }}
                aria-label={`View recipe for ${meal.strMeal}`}
              >
                <img
                  src={meal.strMealThumb}
                  alt={meal.strMeal}
                  loading="lazy"
                />

                <div className="meal-info">
                  <h3>{meal.strMeal}</h3>

                  <p>
                    {meal.strArea ||
                      "Cuisine details unavailable"}
                  </p>

                  {meal.strCategory && (
                    <span className="tag">
                      {meal.strCategory}
                    </span>
                  )}

                  <span className="recipe-link">
                    View recipe →
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="catalogue-note">
        Catalogue collected from TheMealDB alphabetic search
        results:{" "}
        {loading
          ? "loading…"
          : `${catalogue.length} unique meals loaded`}.
        This may not include every meal in the full database.
      </p>

      {/* Recipe loading popup */}
      {recipeLoading && (
        <div className="recipe-overlay">
          <div
            className="recipe-modal recipe-loading"
            role="status"
          >
            <p>Loading recipe...</p>
          </div>
        </div>
      )}

      {/* Recipe error popup */}
      {recipeError && (
        <div
          className="recipe-overlay"
          onClick={closeRecipe}
        >
          <div
            className="recipe-modal recipe-error"
            role="alertdialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="recipe-close"
              type="button"
              onClick={closeRecipe}
              aria-label="Close error message"
            >
              ✕
            </button>

            <p>{recipeError}</p>

            <button
              type="button"
              onClick={() => {
                const mealId = selectedMeal?.idMeal;
                if (mealId) openRecipe(mealId);
                else closeRecipe();
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Full recipe details popup */}
      {selectedMeal && (
        <div
          className="recipe-overlay"
          onClick={closeRecipe}
        >
          <article
            className="recipe-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="recipe-close"
              type="button"
              onClick={closeRecipe}
              aria-label="Close recipe"
            >
              ✕
            </button>

            <img
              className="recipe-image"
              src={selectedMeal.strMealThumb}
              alt={selectedMeal.strMeal}
            />

            <div className="recipe-content">
              <h2 id="recipe-title">
                {selectedMeal.strMeal}
              </h2>

              <p className="recipe-meta">
                {selectedMeal.strCategory || "Meal"} ·{" "}
                {selectedMeal.strArea ||
                  "Cuisine unavailable"}
              </p>

              <h3>Ingredients</h3>

              <ul>
                {Array.from({ length: 20 }, (_, index) => {
                  const ingredient = selectedMeal[
                    `strIngredient${index + 1}`
                  ]?.trim();

                  const measure = selectedMeal[
                    `strMeasure${index + 1}`
                  ]?.trim();

                  if (!ingredient) return null;

                  return (
                    <li key={index}>
                      {ingredient}
                      {measure ? ` — ${measure}` : ""}
                    </li>
                  );
                })}
              </ul>

              <h3>Cooking Instructions</h3>

              <p className="recipe-instructions">
                {selectedMeal.strInstructions ||
                  "Instructions are not available for this recipe."}
              </p>

              {selectedMeal.strYoutube && (
                <a
                  className="recipe-video"
                  href={selectedMeal.strYoutube}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  Watch cooking video ↗
                </a>
              )}
            </div>
          </article>
        </div>
      )}
    </main>
  );
}

export default App;

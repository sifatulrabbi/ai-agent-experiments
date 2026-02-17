package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
)

type Model struct {
	ID               string            `json:"id"`              // e.g. "qwen/qwen3.5-plus-02-15"
	CanonicalSlug    string            `json:"canonical_slug"`  // e.g. "qwen/qwen3.5-plus-20260216"
	HuggingFaceID    string            `json:"hugging_face_id"` // may be empty
	Name             string            `json:"name"`            // human‑readable name
	Created          int64             `json:"created"`         // Unix‑epoch seconds
	Description      string            `json:"description"`
	ContextLength    int               `json:"context_length"`
	Architecture     ArchitectureSpec  `json:"architecture"`
	Pricing          PricingSpec       `json:"pricing"`
	TopProvider      TopProviderSpec   `json:"top_provider"`
	PerRequestLimits *json.RawMessage  `json:"per_request_limits"` // unknown / nullable – keep raw JSON
	SupportedParams  []string          `json:"supported_parameters"`
	DefaultParams    DefaultParameters `json:"default_parameters"`
	ExpirationDate   *string           `json:"expiration_date"` // nullable ISO‑8601, nil if absent
}

type ArchitectureSpec struct {
	Modality         string   `json:"modality"`          // e.g. "text+image+video->text"
	InputModalities  []string `json:"input_modalities"`  // ["text","image","video"]
	OutputModalities []string `json:"output_modalities"` // ["text"]
	Tokenizer        string   `json:"tokenizer"`         // e.g. "Qwen3"
	InstructType     *string  `json:"instruct_type"`     // nullable
}

type PricingSpec struct {
	Prompt         string  `json:"prompt"`                     // always a string in the API
	Completion     string  `json:"completion"`                 // always a string
	InputCacheRead *string `json:"input_cache_read,omitempty"` // optional, nil when missing
}

type TopProviderSpec struct {
	ContextLength       int  `json:"context_length"`
	MaxCompletionTokens *int `json:"max_completion_tokens,omitempty"` // nullable
	IsModerated         bool `json:"is_moderated"`
}

type DefaultParameters struct {
	Temperature      *float64 `json:"temperature,omitempty"`
	TopP             *float64 `json:"top_p,omitempty"`
	FrequencyPenalty *float64 `json:"frequency_penalty,omitempty"`
}

func main() {
	// Goal read the entire JSON then convert it to a provider sorted list.
	f, err := os.ReadFile("/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/openrouter-models.json")
	if err != nil {
		log.Panicln(err)
	}

	var models []Model
	if err = json.Unmarshal(f, &models); err != nil {
		log.Panicln(err)
	}

	providersFound := []string{}
	providerSortedModels := make(map[string][]Model)
	for _, model := range models {
		splitName := strings.Split(model.ID, "/")
		if len(splitName) < 2 {
			continue
		}
		provider := splitName[0]
		if existingValues, ok := providerSortedModels[provider]; ok {
			providerSortedModels[provider] = append(existingValues, model)
		} else {
			providersFound = append(providersFound, provider)
			providerSortedModels[provider] = []Model{model}
		}
	}

	fmt.Println("Total models found:", len(models))
	fmt.Println(providersFound)

	newFileDest := "/Users/sifatul/coding/ai-agent-experiments/skill-based-agent/apps/webapp/lib/server/models/models.catalog.json"
	if bytes, err := json.Marshal(providerSortedModels); err != nil {
		log.Fatalln(err)
	} else {
		if err = os.WriteFile(newFileDest, bytes, 0o644); err != nil {
			log.Fatalln(err)
		}
	}
}

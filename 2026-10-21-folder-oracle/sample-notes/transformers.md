# Transformer Architecture

Transformers rely on self-attention to process relationships between tokens in parallel, instead of reading a sequence one step at a time like an RNN. The original design comes from the 2017 paper "Attention Is All You Need".

## Building blocks

- **Token embeddings** turn each token id into a dense vector.
- **Positional encodings** add information about order, since self-attention by itself has no sense of position. Sinusoidal encodings, learned embeddings and rotary embeddings (RoPE) are the common choices.
- **Encoder layers** stack multi-head self-attention and a position-wise feed-forward network. Each sublayer is wrapped in a residual connection and layer normalization.
- **Decoder layers** add masked self-attention, so a position cannot peek at future tokens, plus cross-attention over the encoder output.

## Variants

Encoder-only models such as BERT are good at classification and retrieval. Decoder-only models such as GPT generate text one token at a time. Encoder-decoder models such as T5 suit translation and summarization.

## Why transformers won

Parallel training on GPUs, stable gradients thanks to residual paths, and the ability to model long-range dependencies made transformers the default architecture for language, and later for vision (ViT), audio and protein modeling.

## Costs

Self-attention is quadratic in sequence length, which makes long contexts expensive. Tricks like sparse attention, sliding windows, FlashAttention and KV caching keep memory and latency manageable.

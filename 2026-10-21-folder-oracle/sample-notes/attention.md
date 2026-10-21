# Attention and Self-Attention

The attention mechanism allows a model to focus on relevant parts of an input when producing each part of its output. Instead of squeezing a whole sentence into one fixed vector, the model looks back at every position and decides how much each one matters right now.

## How attention works

Every token is projected into three vectors: a **query**, a **key** and a **value**.

1. Compare the query of the current token with the keys of all tokens using a dot product.
2. Scale the scores by the square root of the key dimension so they do not blow up.
3. Apply softmax to turn the scores into attention weights that sum to one.
4. Take the weighted sum of the value vectors. That sum is the output for this token.

In matrix form: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V.

## Self-attention vs cross-attention

In self-attention the queries, keys and values all come from the same sequence, so each word attends to the other words in its own sentence. In cross-attention the queries come from one sequence (the decoder) and the keys and values from another (the encoder output).

## Multi-head attention

Running several attention heads in parallel lets the model attend to different kinds of relationships at once: one head may track syntax, another coreference, another nearby words. The heads are concatenated and projected back to the model dimension.

## Intuition

Think of attention as a soft lookup table. The query asks a question, the keys advertise what each token contains, and the values are what gets returned.

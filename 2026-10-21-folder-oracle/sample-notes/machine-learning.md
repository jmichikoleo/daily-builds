# Machine Learning Fundamentals

Machine learning is about learning patterns from data instead of writing explicit rules.

## Types of learning

- **Supervised learning**: learn from labeled examples. Regression predicts numbers, classification predicts categories.
- **Unsupervised learning**: find structure without labels, for example clustering with k-means or dimensionality reduction with PCA.
- **Reinforcement learning**: an agent learns by acting in an environment and receiving rewards.

## Training loop

A model has parameters. A loss function measures how wrong its predictions are. Gradient descent nudges the parameters in the direction that lowers the loss, using gradients computed by backpropagation. Learning rate, batch size and number of epochs are typical hyperparameters.

## Neural networks

Neural networks stack layers of weighted sums followed by nonlinear activation functions such as ReLU. Deep neural networks with many layers can approximate very complex functions. Convolutional neural networks work well on images, recurrent neural networks were the classic choice for sequences, and transformers now dominate both.

## Overfitting and generalization

A model that memorizes the training set but fails on new data is overfitting. Common fixes:

- hold out a validation set and use early stopping
- regularization such as L2 weight decay or dropout
- more data or data augmentation
- simpler models

## Evaluation

Accuracy is not enough on imbalanced data. Look at precision, recall, F1 and ROC AUC for classification, and MAE or RMSE for regression. Always keep a final test set you never tune on.

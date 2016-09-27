// markov.js

function train(input) {
  var data = {n : 5,
              gamma : 1.3,
              words : [0],
              word_to_id : {0 : 0},
              next_id : 1,
              states : []};
  function train_for(n, tokens) {
    var i, state;
    if (!data.states[n]) {
      data.states[n] = {};
    }
    var padding = [];
    for (i = 0; i < n; i++) {
      padding.push(0);
    }
    tokens = padding.concat(tokens, [0]);
    for (i = 0; i < tokens.length - n; i++) {
      state = tokens.slice(i, i+n);
      if (!data.states[n][state]) {
        data.states[n][state] = {};
      }
      var node = data.states[n][state];
      node[tokens[i+n]] = (node[tokens[i+n]] || 0) + 1;
    }
  }
  function train(tokens) {
    for (var n = 1; n <= data.n; n++) {
      train_for(n, tokens);
    }
  }
  function word_id(word) {
    if (data.word_to_id.hasOwnProperty(word)) {
      return data.word_to_id[word];
    } else {
      data.words[data.next_id] = word;
      return data.word_to_id[word] = data.next_id++;
    }
  }
  function tokenize(line) {
    var tokens = [];
    var words = line.split(" "); //todo real split
    for (var i = 0; i < words.length; i++) {
      tokens.push(word_id(words[i]));
    }
    return tokens;
  }
  var lines = input.split("\n");
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].length > 0) {
      train(tokenize(lines[i]));
    }
  }
  return data;
}

function generate(data) {
    var i, j, n;
    var utterance = [];
    var state = [], rstate;
    var options;
    var count, marginal_count;
    for (i = 0; i < data.n; i++) {
        state.push(0);
    }
    function randint(lower, upper) {
        // inclusive, exclusive
        return Math.floor(lower + Math.random() * (upper - lower));
    }
    function s(state) {
        return state.join(",");
    }
    function has_state(n, state) {
        return data.states[n].hasOwnProperty(s(state));
    }
    function get_state(n, state) {
        return data.states[n][s(state)];
    }
    function option_sum(options) {
        var sum = 0;
        for (var k in options) {
            if (options.hasOwnProperty(k)) {
                sum += options[k];
            }
        }
        return sum;
    }
    while (true) {
        n = 1 + Math.floor(Math.log(randint(1, Math.floor(Math.pow(data.gamma, data.n)))) / Math.log(data.gamma));
        rstate = state.slice(data.n - n);
        if (!has_state(n, rstate)) {
            continue;
        }
        options = get_state(n, rstate)
        count = option_sum(options);
        i = randint(0, count);
        marginal_count = 0;
        for (var k in options) {
            if (options.hasOwnProperty(k)) {
                marginal_count += options[k];
                if (marginal_count > i) {
                    utterance.push(k);
                    state = state.slice(1).concat([k]);
                    break;
                }
            }
        }
        if (state[state.length - 1] == 0) {
            break;
        }
    }
    var words = [];
    for (i = 0; i < utterance.length - 1; i++) {
        words.push(data.words[utterance[i]]);
    }
    return words;
}

var globalMarkovData;

function loadMarkov(data) {
    globalMarkovData = data;
}

function generateSentence() {
    return generate(globalMarkovData).join(" ");
}

function getGlobalGamma() {
    return globalMarkovData.gamma;
}
function setGlobalGamma(gamma) {
    globalMarkovData.gamma = gamma;
}

var plainTextData;
function haveSeen(fortune) {
  return plainTextData && plainTextData.indexOf(fortune) >= 0;
}

function loadFortunes(callback) {
  $.get("fortunes.txt", function (data) {
    plainTextData = data;
    loadMarkov(train(data));
    (callback || (function () {}))(data);
  });
}
// topic.js
// topic modeling

function cleanAndTokenize(line) {
  var re = /([a-z][a-z']*[a-z]|[a-z]+)/g;
  var match;
  var words = [];
  while (match = re.exec(line.toLowerCase())) {
    words.push(stemmer(match[1]));
  }
  return words;
}

var topicWords = {};
var topicMatrix;

function loadTopics(words, matrix) {
  var i;
  words = words.split(" ");
  for (i = 0; i < words.length; i++) {
    topicWords[words[i]] = i;
  }
  topicMatrix = matrix;
}

function evaluateTopics(line) {
  var i, j;
  var vector = {};
  var words = cleanAndTokenize(line);
  for (i = 0; i < words.length; i++) {
    if (topicWords.hasOwnProperty(words[i])) {
      j = topicWords[words[i]];
      if (vector.hasOwnProperty(j)) {
        vector[j] += 1;
      } else {
        vector[j] = 1;
      }
    }
  }
  var numtopics = topicMatrix.length;
  var topics = [];
  for (i = 0; i < numtopics; i++) {
    topics[i] = 0;
  }
  for (j in vector) {
    if (!vector.hasOwnProperty(j)) continue;
    if (vector[j]) {
      for (i = 0; i < numtopics; i++) {
        topics[i] += vector[j] * topicMatrix[i][j];
      }
    }
  }
  return topics;
}

// markov

function train(input) {
  var data = {n : 5,
              gamma : 1.3,
              words : [0],
              word_to_id : {0 : 0},
              next_id : 1,
              states : []};
  function train_for(topic, weight, n, tokens) {
    var i, state;
    if (!data.states[topic][n]) {
      data.states[topic][n] = {};
    }
    var padding = [];
    for (i = 0; i < n; i++) {
      padding.push(0);
    }
    tokens = padding.concat(tokens, [0]);
    for (i = 0; i < tokens.length - n; i++) {
      state = tokens.slice(i, i+n);
      if (!data.states[topic][n][state]) {
        data.states[topic][n][state] = {};
      }
      var node = data.states[topic][n][state];
      node[tokens[i+n]] = (node[tokens[i+n]] || 0) + weight;
    }
  }
  function train(topic, weight, tokens) {
    if (!data.states[topic]) {
      data.states[topic] = [];
    }
    if (weight <= 0) {
      return;
    }
    for (var n = 1; n <= data.n; n++) {
      train_for(topic, weight, n, tokens);
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
      var topics = evaluateTopics(lines[i]);
      for (var j = 0; j < topics.length; j++) {
        train(j, topics[j], tokenize(lines[i]));
      }
    }
  }
  return data;
}

function generate(data, seed) {
    var i, j, n;
    var utterance = [];
    var state = [], rstate;
    var options;
    var count, marginal_count;

    var topics = evaluateTopics(seed);

    if (Math.max.apply(null, topics) <= 0) {
      for (j = 0; j < topics.length; j++) {
        topics[j] = Math.random(); // Maybe there's something more sensible?
      }
    }
    if (console && console.log) {
      console.log(topics.join(", "));
    }

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
      for (var t = 0; t < topics.length; t++) {
        if (data.states[t][n] && data.states[t][n].hasOwnProperty(s(state))) {
          return true;
        }
      }
      return false;
    }
    function get_state(n, state) {
      var trans = {};
      var ss = s(state);
      for (var i = 0; i < topics.length; i++) {
        if (!data.states[i][n]) continue;
        var tfunc = data.states[i][n][ss];
        for (var t in tfunc) {
          if (tfunc.hasOwnProperty(t)) {
            trans[t] = (trans[t] || 0) + Math.max(0, topics[i]) * tfunc[t];
          }
        }
      }
      return trans;
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
        options = get_state(n, rstate);
        count = option_sum(options);
        i = Math.random() * count;
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

function generateSentence(seed) {
    return generate(globalMarkovData, seed).join(" ");
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

function rejigger() {
  $(".fortune").each(function (i, f) {
    var $fortune = $(f);
    var $dest = $fortune.find(".fortuneDest");
    $dest.css({
      "margin-top" : ($fortune.innerHeight()*2/4 - $dest[0].scrollHeight)/2
    });
  });
}

$(function () {
  $(window).on("resize", rejigger);
});


function makeFortune($dest, seed) {
  var $fortune = $('<div class="fortune"><div class="fortuneDisp"><div class="ul"></div><div class="ll"></div><div class="ur"></div><div class="lr"></div><div class="fortuneDest"></div></div></div>');
  $dest.append($fortune);
  var emergency = 0;
  do {
    emergency++;
    do {
      var sentence = generateSentence(seed);
    } while (haveSeen(sentence));
    var $fortuneDest = $fortune.find(".fortuneDest");
    $fortuneDest.text(sentence);
  } while (emergency < 100 && $fortune.innerHeight()*3/4 < $fortuneDest[0].scrollHeight);
  function quasi_normal(mean, stdev) {
    var u = (Math.random()*2-1)+(Math.random()*2-1)+(Math.random()*2-1);
    return mean + u * stdev;
  }
  $fortune.find(".fortuneDisp").css({
    top: quasi_normal(0, 5),
    left: quasi_normal(0, 20)
  });
  $fortune.hide();
  $fortune.effect("slide");
  rejigger();
}

// porter stemmer

// Porter stemmer in Javascript. Few comments, but it's easy to follow against the rules in the original
// paper, in
//
//  Porter, 1980, An algorithm for suffix stripping, Program, Vol. 14,
//  no. 3, pp 130-137,
//
// see also http://www.tartarus.org/~martin/PorterStemmer

// Release 1 be 'andargor', Jul 2004
// Release 2 (substantially revised) by Christopher McKenzie, Aug 2009

var stemmer = (function(){
  var step2list = {
    "ational" : "ate",
    "tional" : "tion",
    "enci" : "ence",
    "anci" : "ance",
    "izer" : "ize",
    "bli" : "ble",
    "alli" : "al",
    "entli" : "ent",
    "eli" : "e",
    "ousli" : "ous",
    "ization" : "ize",
    "ation" : "ate",
    "ator" : "ate",
    "alism" : "al",
    "iveness" : "ive",
    "fulness" : "ful",
    "ousness" : "ous",
    "aliti" : "al",
    "iviti" : "ive",
    "biliti" : "ble",
    "logi" : "log"
    },

      step3list = {
        "icate" : "ic",
        "ative" : "",
        "alize" : "al",
        "iciti" : "ic",
        "ical" : "ic",
        "ful" : "",
        "ness" : ""
        },

      c = "[^aeiou]",          // consonant
      v = "[aeiouy]",          // vowel
      C = c + "[^aeiouy]*",    // consonant sequence
      V = v + "[aeiou]*",      // vowel sequence

      mgr0 = "^(" + C + ")?" + V + C,               // [C]VC... is m>0
      meq1 = "^(" + C + ")?" + V + C + "(" + V + ")?$",  // [C]VC[V] is m=1
      mgr1 = "^(" + C + ")?" + V + C + V + C,       // [C]VCVC... is m>1
      s_v = "^(" + C + ")?" + v;                   // vowel in stem

  return function (w) {
    var stem,
        suffix,
        firstch,
        re,
        re2,
        re3,
        re4,
        origword = w;

    if (w.length < 3) { return w; }

    firstch = w.substr(0,1);
    if (firstch == "y") {
      w = firstch.toUpperCase() + w.substr(1);
      }

    // Step 1a
    re = /^(.+?)(ss|i)es$/;
    re2 = /^(.+?)([^s])s$/;

    if (re.test(w)) { w = w.replace(re,"$1$2"); }
    else if (re2.test(w)) {w = w.replace(re2,"$1$2"); }

    // Step 1b
    re = /^(.+?)eed$/;
    re2 = /^(.+?)(ed|ing)$/;
    if (re.test(w)) {
      var fp = re.exec(w);
      re = new RegExp(mgr0);
      if (re.test(fp[1])) {
        re = /.$/;
        w = w.replace(re,"");
        }
      } else if (re2.test(w)) {
        var fp = re2.exec(w);
        stem = fp[1];
        re2 = new RegExp(s_v);
        if (re2.test(stem)) {
          w = stem;
          re2 = /(at|bl|iz)$/;
          re3 = new RegExp("([^aeiouylsz])\\1$");
          re4 = new RegExp("^" + C + v + "[^aeiouwxy]$");
          if (re2.test(w)) {w = w + "e"; }
          else if (re3.test(w)) { re = /.$/; w = w.replace(re,""); }
          else if (re4.test(w)) { w = w + "e"; }
          }
        }

    // Step 1c
    re = /^(.+?)y$/;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      re = new RegExp(s_v);
      if (re.test(stem)) { w = stem + "i"; }
      }

    // Step 2
    re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      suffix = fp[2];
      re = new RegExp(mgr0);
      if (re.test(stem)) {
        w = stem + step2list[suffix];
        }
      }

    // Step 3
    re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      suffix = fp[2];
      re = new RegExp(mgr0);
      if (re.test(stem)) {
        w = stem + step3list[suffix];
        }
      }

    // Step 4
    re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
    re2 = /^(.+?)(s|t)(ion)$/;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      re = new RegExp(mgr1);
      if (re.test(stem)) {
        w = stem;
        }
      } else if (re2.test(w)) {
        var fp = re2.exec(w);
        stem = fp[1] + fp[2];
        re2 = new RegExp(mgr1);
        if (re2.test(stem)) {
          w = stem;
          }
        }

    // Step 5
    re = /^(.+?)e$/;
    if (re.test(w)) {
      var fp = re.exec(w);
      stem = fp[1];
      re = new RegExp(mgr1);
      re2 = new RegExp(meq1);
      re3 = new RegExp("^" + C + v + "[^aeiouwxy]$");
      if (re.test(stem) || (re2.test(stem) && !(re3.test(stem)))) {
        w = stem;
        }
      }

    re = /ll$/;
    re2 = new RegExp(mgr1);
    if (re.test(w) && re2.test(w)) {
      re = /.$/;
      w = w.replace(re,"");
      }

    // and turn initial Y back to y

    if (firstch == "y") {
      w = firstch.toLowerCase() + w.substr(1);
      }

    return w;
    };
})();
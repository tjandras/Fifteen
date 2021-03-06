String.prototype.hashCode = function() { // From: http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
    "use strict";
    var hash = 0, i, chr, len;
    if (this.length == 0) {
        return hash;
    }
    for (i = 0, len = this.length; i < len; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

var Result = function(seconds, steps, startPermutation) {
    "use strict";

    if (arguments.length === 3) {
        this.permutationId = startPermutation.toString().hashCode(); 
        this.time = seconds;
        this.moves = steps;
        this.initialPermutation = startPermutation;
    }

    this.serialize = function() {
        return this.permutationId + '/' + this.time + '/' + this.moves + '/' + this.initialPermutation;
    };

    this.deserialize = function(result) {
        var parts = result.split('/');
        this.permutationId = parts[0];
        this.time = parts[1];
        this.moves = parts[2];
        this.initialPermutation = parts[3].split(',');
        return this;
    };

    this.output = function(index, loadClickCallback) {
        var p = document.createElement('p');
        var min = (this.time/60>>0); //http://stackoverflow.com/questions/4228356/integer-division-in-javascript
        var sec = this.time - min*60;
        p.appendChild(document.createTextNode((min < 10 ? '0' + min : min) + ':'
            + (sec < 10 ? '0' + sec : sec) + ' | ' + this.moves + ' moves (' + this.permutationId + ') '));
        var loadLink = document.createElement('a');
        loadLink.setAttribute('href', '#');
        loadLink.setAttribute('data-index', index);
        loadLink.appendChild(document.createTextNode('Load this game'));
        core.addEventListener(loadLink, 'click', loadClickCallback);
        p.appendChild(loadLink);
        return p;
    };
};

var ResultStore = function(container, clearElement, resultListSize, loadGameCallback) {
    "use strict";

    var localStorageSupported = true;
    var localStorageTopTimesKey = 'fifteen.toptimes';
    var topResults = [];

    var initResults = function() {
        var resultsByTime = localStorage.getItem(localStorageTopTimesKey);
        if (resultsByTime) {        
            var resultsArr = resultsByTime.split(';');
            for (var i = 0; i < resultsArr.length; ++i) {
                var res = new Result().deserialize(resultsArr[i]);
                topResults.push(res);
                container.appendChild(res.output(i, loadGameCallback));
            }
        }
        core.addEventListener(clearElement, 'click', clearResults);
    };

    this.add = function(newResult) {
        if (localStorageSupported) {
            topResults.push(newResult);
            orderResults();
            storeResults();
            redrawResults();
        }
    };

    this.loadPermutation = function(index) {
        return topResults[index].initialPermutation;
    };

    var orderResults = function() {
        topResults.sort(function(r1, r2) {
            if (r1.time < r2.time) {
                return -1;
            }
            if (r1.time > r2.time) {
                return 1;
            }
            if (r1.moves < r2.moves) {
                return -1;
            }
            if (r1.moves > r2.moves) {
                return 1;
            }
            return 0;
        });
        while (topResults.length > resultListSize) {
            topResults.pop();
        }
    };

    var storeResults = function() {
        localStorage.setItem(localStorageTopTimesKey, serializeResults());
    };

    var serializeResults = function() {
        var ser = '';
        for(var i = 0, result; result = topResults[i]; ++i) { // reduce not supported in IE < 9
            ser += result.serialize() + ';';
        }
        return ser.slice(0, -1);
    };

    var redrawResults = function() {
        container.innerHTML = '';
        for (var i = 0; i < topResults.length; ++i) {
            container.appendChild(topResults[i].output(i, loadGameCallback));
        };
    };

    var testFeature = function() {
        // From modernizr
        var mod = 'modernizr';
        try {
          localStorage.setItem(mod, mod);
          localStorage.removeItem(mod);
          return true;
        } catch (e) {
          return false;
        }
    };

    var clearResults = function(event) {
        core.preventDefault(event);
        if (confirm('Do you really want to clear the top results?') === true) {
            localStorage.clear();
            topResults = [];
            redrawResults();
        }
    }

    if (testFeature() === true) {
        initResults();
    } else {
        var localStorageSupported = false;
        var noStorageElem = document.createElement('p');
        noStorageElem.appendChild(document.createTextNode("Your browser does not support local storage. Your top results cannot be saved."));
        container.appendChild(noStorageElem);
    }
};

(function (Fifteen) {
    "use strict";

    var self = Fifteen;
    var finalStanding = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1];
    var greenPositions = [0, 2, 5, 7, 8, 10, 13, 15]; // http://www.math.ubc.ca/~cass/courses/m308-02b/projects/grant/fifteen.html
    var board;
    var rows;
    var emptyCell = [];
    var gameInProgress = false;
    var initialPermutation;
    var moves = 0;
    var moveContainer = document.getElementById('moves');
    var timeContainer = document.getElementById('time');
    var timerInterval;
    var startDate;
    var resultStore;

    self.init = function () {
        getCellReferences();
        initBoard();
        core.addEventListener(document.getElementById('f2'), 'click', newGameClickHandler);
        core.addEventListener(document, 'keydown', handleKeyDown);

        if (!Array.prototype.indexOf) {
            Array.prototype.indexOf = function(needle) {
                for (var i = 0; i < this.length; i++) {
                    if (this[i] === needle) {
                        return i;
                    }
                };

                return -1;
            }
        }

        resultStore = new ResultStore(document.getElementById('results'), document.getElementById('clear'), 10, loadGame);
    };

    self.printInitialPermutation = function (argument) {
        console.log(initialPermutation);
    };

    var getCellReferences = function () {
        board = [[], [], [], []];
        rows = [];

        var htmlBoard = document.getElementById('board');
        var htmlRows = htmlBoard.getElementsByTagName('tr');

        for (var i = 0, htmlRow; htmlRow = htmlRows[i]; i++) {
            var row = [];
            var htmlCells = htmlRow.getElementsByTagName('td');
            for (var j = 0, cell; cell = htmlCells[j]; j++) {
                var link = document.createElement('a');
                link.href = '#';
                link.setAttribute('data-row', i);
                link.setAttribute('data-column', j);
                core.addEventListener(link, 'click', tileMoved)
                cell.appendChild(link);
                row.push(link);

                board[i].push(-1);
            }
            rows.push(row);
        }
    };

    var initBoard = function () {
        for (var i = 0, row; row = board[i]; i++) {
            for (var j = 0; j < row.length; j++) {
                var value = (i * 4) + (j + 1);
                if (value < 16) {
                    updateTile(i, j, value);
                } else {
                    emptyCell.push(i);
                    emptyCell.push(j);
                }
            }
        }
    };

    var newGameClickHandler = function(event) {
        core.preventDefault(event);
        shuffleBoard(null);
    };

    var loadGame = function(event) {
        shuffleBoard(this.getAttribute('data-index'));
    };

    var shuffleBoard = function (resultId) {
        if (gameInProgress) {
           if (!confirm('A game is already started. Do you want to start a new one?')) {
               return;
           }
           clearInterval(timerInterval);
        }

        gameInProgress = true;
        moves = 0;
        updateMoveCounter(moves);
        startDate = Date.now();
        
        if (resultId === null) {
            initialPermutation = finalStanding.slice(0);
            shuffle(initialPermutation);
        } else {
            initialPermutation = resultStore.loadPermutation(resultId);
        }    

        for (var i = 0, value; value = +initialPermutation[i]; i++) {
            var row = Math.floor(i / 4);
            var column = i % 4;
            updateTile(row, column, value);
            if (value === '' || value === -1) {
                emptyCell = [row, column];
            }
        }

        timerInterval = setInterval(updateTime, 1000);
    };

    var updateTile = function (row, column, newValue) {
        // View
        var oldValue = rows[row][column].innerHTML;
        if (newValue > 0) {
            rows[row][column].innerHTML = newValue;
        } else {
            rows[row][column].innerHTML = '';
        }

        // Model
        board[row][column] = newValue;

        return oldValue;
    };

    var updateMoveCounter = function(moves) {
        moveContainer.innerHTML = moves;
    };

    var updateTime = function() {
        var totalSec = Math.floor((Date.now() - startDate) / 1000);
        var diffSec = totalSec;
        var diffMin = Math.floor(diffSec / 60);
        diffSec -= diffMin * 60;
        timeContainer.innerHTML = (diffMin < 10 ? '0' + diffMin : diffMin) + ':' + (diffSec < 10 ? '0' + diffSec : diffSec);
        return totalSec;
    };

    var shuffle = function (array) {
        // Fisher-Yates shuffle

        var length = array.length;
        var temp;
        var randomElement;
        
        // While there remain elements to shuffle…
        while (length) {
            // Pick a remaining element…
            randomElement = Math.floor(Math.random() * length--);
            // And swap it with the current element.
            swap(array, length, randomElement);
        }

        checkShuffleParity(array);
    };

    var swap = function(array, left, right) {
        var temp = array[left];
        array[left] = array[right];
        array[right] = temp;
    };

    var checkShuffleParity = function (array) {
        // A shuffle is solvable if the permutation parity is even and the empty cell is on a white field OR
        // the parity is odd and the empty cell is on a green field.

        var onGreen;
        var emptyIndex;
        var parity = 0;

        for (var i = 0; i < array.length; i++) {
            if (array[i] === -1) {
                emptyIndex = i;
                onGreen = greenPositions.indexOf(i) > -1 ? true : false;
            }
            for (var j = i; j < array.length; j++) {
                if (array[i] > array[j]) {
                    parity++;
                }
            }
        }

        parity = parity % 2;

        if ((parity === 0 && onGreen) || (parity === 1 && !onGreen)){
            swap(array, array[array.length-2], array[array.length-1]);
        }
    };

    var handleKeyDown = function(event) {
        var key = getKey(event);
        
        if (key == 'F2') {
            newGameClickHandler(event);
        }

        if (key.indexOf('Arrow') === 0) {
            tileMoved(event, key);
        }
    };

    var getKey = function(event) {
        if (event.key) {
            switch (event.key) {
                case 'Left':
                    return 'ArrowLeft';
                case 'Up':
                    return 'ArrowUp';
                case 'Right':
                    return 'ArrowRight';
                case 'Down':
                    return 'ArrowDown';
                default:
                    return event.key;
            }
        }

        switch(event.keyCode) {
            case 37:
                return 'ArrowLeft';
            case 38:
                return 'ArrowUp';
            case 39:
                return 'ArrowRight';
            case 40:
                return 'ArrowDown';
            case 113:
                return 'F2';
        }
    };

    var tileMoved = function (event, key) {
        core.preventDefault(event);

        var row;
        var column;

        if (key) {
            switch(key) {
                case 'ArrowLeft':
                    row = emptyCell[0];
                    column = emptyCell[1] + 1;
                    break;
                case 'ArrowRight':
                    row = emptyCell[0];
                    column = emptyCell[1] - 1;
                    break;
                case 'ArrowUp':
                    row = emptyCell[0] + 1;
                    column = emptyCell[1];
                    break;
                case 'ArrowDown':
                    row = emptyCell[0] - 1;
                    column = emptyCell[1];
                    break;
                default:
                    return;
            }
        } else {
            row = parseInt(this.getAttribute('data-row'));
            column = parseInt(this.getAttribute('data-column'));
        }

        move(row, column);

        checkTable();
    };

    var move = function (row, column) {
        if (row < 0 || row > 3 || column < 0 || column > 3) {
            return;
        }

        var rowDistance = Math.abs(emptyCell[0] - row);
        var columnDistance = Math.abs(emptyCell[1] - column);
        if ((rowDistance === 1 && columnDistance === 0) ||
            (rowDistance === 0 && columnDistance === 1)) {
                swapCells(emptyCell[0], emptyCell[1], row, column);
                emptyCell = [row, column];
                updateMoveCounter(++moves);
        }
    };

    var swapCells = function (row1, column1, row2, column2) {
        var oldValue = updateTile(row1, column1, board[row2][column2]);
        updateTile(row2, column2, oldValue);
    };

    var checkTable = function () {
        if (!gameInProgress) {
            return;
        }
        
        var index = 0;
        for (var i = 0, row; row = board[i]; i++) {
            for (var j = 0; j < row.length; j++) {
                var boardValue = board[i][j];
                if (boardValue === ''){
                    boardValue = -1;
                }
                if (boardValue !== finalStanding[index++])
                {
                    return;
                }
            }
        }

        clearInterval(timerInterval);
        gameInProgress = false;
        resultStore.add(new Result(updateTime(), moves, initialPermutation));
        alert('Done! :)');
    };
})(window.Fifteen = window.Fifteen || {});

core.onLoaded(Fifteen.init);
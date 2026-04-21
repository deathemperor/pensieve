import wordsApi from "./words.js"

const gameContainer = document.getElementById('game-container')
const startButton = document.getElementById('start-button')
const easyButton = document.getElementById("easy-button")
const mediumButton = document.getElementById("medium-button")
const hardButton = document.getElementById("hard-button")
const loginButton = document.getElementById('login-button')
const signUpButton = document.getElementById('signup-button')
const authButtons = document.getElementById("authButtons")
const continueButton = document.getElementById('next-level')
const updateUserButton = document.getElementById("update-user")
const deleteUserButton = document.getElementById("delete-user")
const exit2Button = document.getElementById('exit2')
const exit1Button = document.getElementById('exit')
const btn = document.getElementById("myBtn");
const timer = document.getElementById("underline3")
const popUp = document.getElementById('popUp-container')
const moreStats = document.getElementById('view-stats')
const failPopUp = document.getElementById('popUpFail-container')
const viewStatsFail = document.getElementById('view2-stats')
const statsContainerPop = document.getElementById('popUpStats-container')
const totalSharksKilled = document.getElementById('totalSharksKilled')
const authLoginForm = document.getElementById('auth-login')
const authSignUpForm = document.getElementById('auth-signup')
const allSharksKilledText = document.getElementById('underline2')
const shownDifficultyLevel = document.getElementById("underline4")
const usersTotalPoints = document.createElement("h5")
const usersTotalSharks = document.createElement("h5")
const userGames = document.createElement("h5")
const usersAvgDiff = document.createElement("h5")
const modal = document.getElementById("myModal");
const span = document.getElementsByClassName("close")[0];
const overallStats = document.getElementById("overall-stats")
const allGames = document.getElementById("all-games")
const speedWordContainer = document.getElementById("speedWord")
const gamePoints = document.getElementById("underline1")
const gameSharksKilled = document.getElementById("underline2")
const treasureClosed = document.getElementById("closedTreasure")
const winTreasurePopUp = document.getElementById("treasure-pop-up")
const rubyGem = document.getElementById("ruby-gem")
const speedRoundStatsPopUp = document.getElementById("underline5")
const updateUserInfoForm = document.getElementById("update-user-info")
const usernameHeader = document.createElement("h2")
const allSharksKilled = document.getElementById('sharksKilled')
const bossWarning = document.getElementById("incoming-boss")

const asciiString = '0123456789abcdefghijklmnopqrstuvwxyz'
const asciiArray = asciiString.split("")

let movingRedTimerBox = document.getElementById("red-moving-timer-box")
let currentUserGameId = null
let chosenDifficulty = null
let currentUser = null
let currentUserId = null
let currentUserToken = null
let currentUserGames = null
let currentUserPoints = null
let currentUserSharks = null
let currentUsersGamesObj = null
let currentUserDiffAvg = null
let totalTime = null
let bossShark = null

let speedArray = []
let clearIntArray = []
let cannonBallIntervalArr = []

let level = 1
let speedIndex = 0
let index = 0
let pointsTotal = 0
let sharksTotal = 0
let clearIndex = 0
let incrementer = 0
let bossIncrementer = 0
let topStyleArrayIncrementer = 0
let game3Index = 0

let username;
let password;
let bossPoints;
let game3Time;
let victory;
let bossSharkInterval;
let cannonImg;

let movingTimerBox = document.getElementById("moving-timer-box")
let logOutButton = document.createElement('button')
logOutButton.innerText = "Logout"

let textContent = ""
let topStyleArray = [75, 15, 55, 35, 75, 10, 55, 35, 10, 75, 55, 30]

bossShark = document.createElement("img")
bossShark.id = "boss-shark"
bossShark.src = "resources/boss_shark.gif"
bossShark.style.right = "-40%"

// const herokuProfile = "https://type-your-shark.herokuapp.com/profile"
// const herokuUsers = "https://type-your-shark.herokuapp.com/users"
// const herokuLogin = "https://type-your-shark.herokuapp.com/login"
// const herokuUsersId = `https://type-your-shark.herokuapp.com/users/${currentUserId}`
// const herokuGameId = `https://type-your-shark.herokuapp.com/games/${currentUserGameId}`
// const herokuGame = "https://type-your-shark.herokuapp.com/games"

// const localHost3000Profile = "http://localhost:3000/profile"
// const localHost3000Users = "http://localhost:3000/users"
// const localHost3000Login = "http://localhost:3000/login"
// const localHost3000UsersId = `http://localhost:3000/users/${currentUserId}`
// const localHost3000GameId = `http://localhost:3000/games/${currentUserGameId}`
// const localHost3000Game = "http://localhost:3000/games"

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.token) {
        appendLogoutButtonToAuthButtons()
        changeVisibilityAuthButtons()
        changeBlackOutsDisplay()
        changeMyBtnVisibility()
        setCurrentUserVariables()
        fillOutPopUpOverallStats()
        fillOutPopUpOverallGames()
    }
})

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setCurrentUserVariables() {
    currentUser = localStorage.getItem('user')
    currentUserToken = localStorage.getItem("token")
    currentUserId = localStorage.getItem("userId")
    currentUserDiffAvg = localStorage.getItem("userAvgDiff")
    currentUserGames = localStorage.getItem("userGames")
    currentUserPoints = localStorage.getItem("userPoints")
    currentUserSharks = localStorage.getItem("userSharks")
    currentUsersGamesObj = JSON.parse(localStorage.getItem("userGamesObj"))
}

function changeVisibilityAuthButtons() {
    signUpButton.style.visibility = "hidden"
    loginButton.style.visibility = "hidden"
}

function changeMyBtnVisibility() {
    btn.style.visibility = "visible"
}

function changeBlackOutsDisplay() {
    document.getElementById('blackout').style.display = 'none';
    document.getElementById('blackout2').style.display = 'none';
}

function appendLogoutButtonToAuthButtons() {
    authButtons.appendChild(logOutButton)
}

function checkForToken() {
    if (localStorage.token) {
        appendLogoutButtonToAuthButtons()
        changeVisibilityAuthButtons()
        changeBlackOutsDisplay()
    }
}

logOutButton.addEventListener("click", () => {
    fetch("http://localhost:3000/profile", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${localStorage.token}`
        }
    })
        .then(localStorage.clear())
        .then(location.reload())
})

signUpButton.addEventListener("click", (event) => {
    event.preventDefault();
    authSignUpForm.style.display = 'block';
    changeVisibilityAuthButtons()
})

loginButton.addEventListener("click", (event) => {
    event.preventDefault();
    authLoginForm.style.display = 'block';
    changeVisibilityAuthButtons()
})

function grabFormData(event) {
    const formData = new FormData(event.target)
    username = formData.get("username")
    password = formData.get("password")
}

authSignUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authSignUpForm.style.display = 'none';

    grabFormData(event)

    await fetch("http://localhost:3000/users", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user: {
                username,
                password
            }
        })
    })
        .then(response => response.json())
        .then(setItemsIntoLocalStorageOnSignUp)

    setCurrentUserVariablesInSignUp()
    fillOutPopUpOverallStats()
})

function setItemsIntoLocalStorageOnSignUp(result) {
    localStorage.setItem("token", result.token)
    localStorage.setItem("userId", result.user.user_id)
    localStorage.setItem("user", username)
}

function setCurrentUserVariablesInSignUp() {
    currentUserToken = localStorage.getItem("token")
    currentUserId = localStorage.getItem("userId")
    currentUserDiffAvg = "easy"
    currentUser = username
    checkForToken()
    changeBlackOutsDisplay()
}

authLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authLoginForm.style.display = 'none';

    grabFormData(event)

    await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password
        })
    })
        .then(response => response.json())
        .then(checkLoginForError)

    setCurrentUserVariables()
    fillOutPopUpOverallStats()
    fillOutPopUpOverallGames()
})

function checkLoginForError(result) {
    return result.error ? (alert(result.error), location.reload()) : (setItemsIntoLocalStorageOnLogin(result), checkForToken(), changeBlackOutsDisplay(), changeMyBtnVisibility())
}

function setItemsIntoLocalStorageOnLogin(result) {
    localStorage.setItem("token", result.token)
    localStorage.setItem("user", result.user.username)
    localStorage.setItem("userId", result.user.id)
    localStorage.setItem("userGames", result.user.total_games)
    localStorage.setItem("userSharks", result.user.total_sharks_killed)
    localStorage.setItem("userPoints", result.user.total_points)
    localStorage.setItem("userAvgDiff", result.user.avg_difficulty)
    localStorage.setItem("userGamesObj", JSON.stringify(result.user.games.map(x => x)))
}

function DifficultyLevelButtonDisplay() {
    easyButton.style.display = "none"
    mediumButton.style.display = "none"
    hardButton.style.display = "none"
}

function statsContainerPopZindexChange() {
    statsContainerPop.style.zIndex = "1"
}

function popUpZindexChange() {
    popUp.style.zIndex = "-1"
}

function gamePointsInnerText() {
    gamePoints.innerText = " " + pointsTotal
}

function failPopUpZindexChange() {
    failPopUp.style.zIndex = "-1"
}

function changeDisplayOfItemsSpeedRound() {
    movingTimerBoxesBlock()
    treasureClosed.style.display = "block"
    speedWordContainer.style.display = "block"
}

function popUpZindexChangeBack() {
    popUp.style.zIndex = "1"
}

function changeDisplayOfItemsSpeedRoundBack() {
    winTreasurePopUp.style.display = "none"
    treasureClosed.style.display = "none"

    movingRedTimerBox.style.display = "none"
    movingTimerBox.style.display = "none"
    movingRedTimerBox.style.width = "0%"
}

function setChosenDifficultytoEasy() {
    chosenDifficulty = "easy"
}

startButton.addEventListener("click", () => {
    startButton.style.display = "none"

    if (!chosenDifficulty) {
        setChosenDifficultytoEasy()
        shownDifficultyLevel.innerText = "Easy"
    }

    DifficultyLevelButtonDisplay()
    gameCountdown()
})

continueButton.addEventListener('click', () => {
    level++

    popUpZindexChange()
    checkLevel()
})

function level2ContinueActions() {
    document.getElementById("overlap").style.display = "none"

    changeDisplayOfItemsSpeedRound()
    game2Countdown()
}

function checkLevel() {
    if (level == 2) {
        level2ContinueActions()
    } else if (level == 3) {
        level3ContinueActions()
    }
}

function keydownEventO() {
    document.body.addEventListener("keydown", killShark)
}

function bossWarningOff() {
    bossWarning.style.zIndex = "-1"
}

function level3ContinueBeforeIntervalActions() {
    gameContainer.style.backgroundImage = "url('https://media.giphy.com/media/XWHe62Za5zPck/giphy.gif')"

    keydownEventO()
    difficultyDecider()
    createBossShark()

    incrementer = 0
    bossPoints = 0
}

function removeAllDots() {
    document.querySelectorAll('.dot').forEach((item) => item.remove())
}

function clearCannonBallInterval() {
    cannonBallIntervalArr.forEach((cannonBall) => clearInterval(cannonBall))
}

function speedRoundStatsPopUpGamePointsInnerText() {
    speedRoundStatsPopUp.innerText = gamePoints.innerText
}

function totalSharksKilledInnerText() {
    totalSharksKilled.innerText = allSharksKilled.innerText
}

easyButton.addEventListener("click", () => {
    setChosenDifficultytoEasy()

    shownDifficultyLevel.innerText = "Easy"
})

mediumButton.addEventListener("click", () => {
    chosenDifficulty = "medium"
    shownDifficultyLevel.innerText = "Medium"
})

hardButton.addEventListener("click", () => {
    chosenDifficulty = "hard"
    shownDifficultyLevel.innerText = "Hard"
})

moreStats.addEventListener('click', () => {
    statsContainerPopZindexChange()
    popUpZindexChange()
})

viewStatsFail.addEventListener('click', () => {
    statsContainerPopZindexChange()
    failPopUpZindexChange()
})

exit2Button.addEventListener('click', () => {
    statsContainerPop.style.zIndex = "-1"

    reloadGame()
})

exit1Button.addEventListener('click', () => {
    popUpZindexChange()
    reloadGame()
})

exit3.addEventListener('click', () => {
    failPopUpZindexChange()
    reloadGame()
})

rubyGem.addEventListener('click', () => {
    popUpZindexChangeBack()
    changeDisplayOfItemsSpeedRoundBack()
})

btn.addEventListener('click', () => {
    fetch(`http://localhost:3000/users/${currentUserId}`)
        .then(response => response.json())
        .then(redefineStats)
})

btn.onclick = function () {
    modal.style.display = "block";
}

span.onclick = function () {
    modal.style.display = "none";
}

deleteUserButton.addEventListener("click", (event) => {
    fetch(`http://localhost:3000/users/${currentUserId}`, {
        method: 'DELETE'
    })
    localStorage.clear()
    location.reload()
})

updateUserButton.addEventListener("click", (event) => {
    updateUserInfoForm.style.display = "block"
})

updateUserInfoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    grabFormData(event)

    await fetch(`http://localhost:3000/users/${currentUserId}`, {
        method: 'PUT',
        headers: {
            "Authorization": `Bearer ${currentUserToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
    })
        .then(response => response.json())
        .then(result => {
            usernameHeader.innerText = result.user.username
            localStorage.setItem('user', result.user.username)
        })
    updateUserInfoForm.style.display = "none"
})

function textContentReset() {
    textContent = ""
}

function gameCountdown() {
    textContentReset()
    keydownEventO()
    gameTimer()
    difficultyDecider()
}

function game2Countdown() {
    textContentReset()
    gameTimer()
    speedRoundDifficulty()

    document.body.addEventListener("keydown", typedSpeedWords)
    level = 2
}

function difficultyDeciderLevel3() {
    if (chosenDifficulty == "medium") {
        return totalTime = 15
    } else if (chosenDifficulty == "hard") {
        return totalTime = 12
    } else {
        return totalTime = 19.0
    }
}

async function difficultyDecider() {
    totalTime = 25.0
    if (level == 3) {
        difficultyDeciderLevel3()
    }
    while (totalTime > 0.0) {
        if (chosenDifficulty == 'hard') {
            await sleep(1000)
            if (totalTime > 0.0) {
                if (level == 1) {
                    createShark(9, 14, .05)
                } else if (level == 3) {
                    createShark(4, 4, .05)
                }
                totalTime -= 1.0
            }
        } else if (chosenDifficulty == 'medium') {
            await sleep(1500)
            if (totalTime > 0.0) {
                if (level == 1) {
                    createShark(6, 8, 0.04)
                } else if (level == 3) {
                    createShark(4, 4, 0.04)
                }
                totalTime -= 1.5
            }
        } else {
            await sleep(3000)
            if (totalTime > 0.0) {
                if (level == 1) {
                    createShark(5, 6, .038)
                } else if (level == 3) {
                    createShark(4, 4, 0.038)
                }
                totalTime -= 3.0
            }
        }
    }
}

function setSpeedWord(word) {
    word.split("").forEach(letter => {
        let currentLetter = document.createElement('span')
        currentLetter.innerText = letter
        currentLetter.className = "speed-letter"

        speedWordContainer.appendChild(currentLetter)
    })
}

function speedRoundDifficulty() {
    let speedWord = wordsApi[Math.floor(Math.random() * 178187)]

    if (chosenDifficulty == "easy") {
        if (speedWord.length < 6) {
            setSpeedWord(speedWord)
        } else {
            speedRoundDifficulty()
        }
    } else if (chosenDifficulty == "medium") {
        if (speedWord.length >= 6 && speedWord.length <= 9) {
            setSpeedWord(speedWord)
        } else {
            speedRoundDifficulty()
        }
    } else {
        if (speedWord.length > 9 && speedWord.length <= 13) {
            setSpeedWord(speedWord)
        } else {
            speedRoundDifficulty()
        }
    }
}

function typedSpeedWords(e) {
    let speedLetterArray = document.querySelectorAll(".speed-letter")
    let typedLetter = String.fromCharCode(e.which).toLowerCase()

    if (typedLetter == speedLetterArray[speedIndex].innerText) {

        speedLetterArray[speedIndex].style.color = "green"
        speedArray.push(typedLetter)
        speedIndex++

        if (speedArray.length == speedLetterArray.length) {
            pointsTotal = parseInt(pointsTotal) + parseInt(speedArray.length)
            totalTime = 1
            speedWordContainer.innerHTML = ""
            speedIndex = 0
            speedArray = []

            gamePointsInnerText()
            speedRoundDifficulty()
        }
    } else {
        totalTime = 2
    }
}

function removeSharks() {
    let allSharksPlaying = document.querySelectorAll('.dot')

    if (level == 3) {
        try {
            document.getElementById('boss-shark').remove()
        } catch (error) { }
    }
    allSharksPlaying.forEach(element => element.remove())
}

function setTimerToZero() {
    totalTime = 0
}

function setTimerInnerTextToZero() {
    timer.innerText = 0
}

function clearIntArrayForEach() {
    clearIntArray.forEach(element => clearInterval(element))
}

function setIndextoZero() {
    index = 0
}

function setClearIntArrayEmpty() {
    clearIntArray = []
}

function gameTimer() {
    incrementer = 25

    if (level == 1) {

        let gameTime = setInterval(() => {
            if (incrementer >= 0) {
                timer.innerText = incrementer
                incrementer--
            }
            let findSharksToEndGame = document.querySelectorAll(".dot")

            if (findSharksToEndGame.length == 0) {
                if (incrementer < 20) {
                    setTimerInnerTextToZero()
                    popUpZindexChangeBack()
                    speedRoundStatsPopUpGamePointsInnerText()
                    totalSharksKilledInnerText()
                    document.body.removeEventListener("keydown", killShark)
                    changeMyBtnVisibility()
                    addGame()
                    removeSharks()
                    clearIntArrayForEach()
                    clearInterval(gameTime)
                }
            } else {
                try {
                    let firstShark = document.querySelector('.dot')
                    if (parseInt(firstShark.style.right) >= 66.5) {
                        setTimerToZero()
                        failPopUpIndexChangeBack()
                        speedRoundStatsPopUpGamePointsInnerText()
                        totalSharksKilledInnerText()
                        document.body.removeEventListener("keydown", killShark)
                        addGame()
                        changeMyBtnVisibility()
                        clearInterval(gameTime)
                    }
                } catch (error) { }
            }
        }, 1000);
    }
    else if (level == 2) {
        incrementer = 0
        let game2Time = setInterval(async () => {
            if (incrementer >= 100) {

                treasureClosed.src = "resources/treasure.gif"
                setTimerInnerTextToZero()
                document.body.removeEventListener("keydown", typedSpeedWords)
                gamePoints.innerText = (parseInt(gamePoints.innerText) + 1000).toString()
                speedRoundStatsPopUpGamePointsInnerText()
                pointsTotal = gamePoints.innerText
                speedWordContainer.style.display = "none"
                updateGame()
                clearInterval(game2Time)
                await sleep(1000)
                winTreasurePopUp.style.display = "block"
            }
            if (totalTime == 1) {
                incrementer -= 5
                setTimerToZero()
            } else if (totalTime == 2) {
                incrementer += 5
                setTimerToZero()
            }
            movingRedTimerBox.style.width = incrementer + "%"
            incrementer += .1
        }, 10);
    }
}

function level3ContinueActions() {
    level3ContinueBeforeIntervalActions()

    game3Time = setInterval(() => {
        if (game3Index >= 25) {
            incomingBoss()
        }
        if (game3Index == 20 || game3Index == 23) {
            bossWarning.style.zIndex = "1"
        } else if (game3Index == 24 || game3Index == 26) {
            bossWarningOff()
        }
        if (bossPoints >= 80) {
            clearCannonBallInterval()
            removeAllDots()

            bossShark.style.zIndex = "-5"
            gameContainer.style.backgroundImage = "url('https://thumbs.gfycat.com/RadiantBlackandwhiteGharial-size_restricted.gif')"
            continueButton.style.display = 'none'

            movingRedTimerBox.style.display = "none"
            movingRedTimerBox.style.width = "0%"
            movingTimerBox.style.display = "none"

            popUpZindexChangeBack()
            speedRoundStatsPopUpGamePointsInnerText()
            totalSharksKilledInnerText()
            createVictoryH2()
            updateGame()
            game3TimeClearInterval()

        }
        incrementer += .5
        game3Index += .5
    }, 500)
}

function createVictoryH2() {
    victory = document.createElement("h2")
    victory.className = "victory"
    victory.innerText = "VICTORY!"
    victory.style.margin = "auto"
    victory.style.textAlign = "center"
    popUp.prepend(victory)
}

function failPopUpIndexChangeBack() {
    failPopUp.style.zIndex = "1"
}

function game3TimeClearInterval() {
    clearInterval(game3Time)
}

function movingTimerBoxesBlock() {
    movingTimerBox.style.display = "block"
    movingRedTimerBox.style.display = "block"
}

function incomingBoss() {
    let cannon = null
    let int = 0
    let cannonContainer = document.createElement('div')

    gameContainer.appendChild(bossShark)
    cannon = document.createElement("span")
    cannon.innerText = asciiArray[Math.round(Math.random() * (asciiArray.length - 2))]

    movingTimerBoxesBlock()
    topStyleIncrementer()
    createCannonBall(cannon, cannonContainer)

    cannonBallIntervalArr.push(setInterval(() => {
        if (int >= 87) {
            failPopUpIndexChangeBack()
            speedRoundStatsPopUpGamePointsInnerText()
            totalSharksKilledInnerText()
            clearCannonBallInterval()
            removeAllDots()
            game3TimeClearInterval()
        }
        cannonContainer.style.right = int + "%"
        if (chosenDifficulty == "easy") {
            int += 0.05
        } else if (chosenDifficulty == "medium") {
            int += .065
        } else {
            int += .075
        }
    }, 10, cannonContainer))
}

function clearBossSharkInterval() {
    clearInterval(bossSharkInterval)
}

function createBossShark() {
    let shark = -40
    bossSharkInterval = setInterval(() => {
        if (shark > 0) {
            clearBossSharkInterval()
        } else {
            if (bossIncrementer > 25) {
                bossShark.style.right = shark + "%"
                shark += 0.5
            }
        }
        bossIncrementer += 0.1
    }, 100)
}

function topStyleIncrementer() {
    if (topStyleArrayIncrementer == 8) {
        topStyleArrayIncrementer = 0
    } else {
        topStyleArrayIncrementer++
    }
}

function createCannonBall(cannon, cannonContainer) {
    cannonContainer.style.top = topStyleArray[topStyleArrayIncrementer] + "%"
    cannonContainer.className = "dot"
    cannonContainer.style.borderRadius = "50%"
    cannonContainer.style.backgroundColor = "grey"
    cannonContainer.style.zIndex = "3"
    cannonContainer.style.right = "10%"
    cannonContainer.style.display = "flex"

    cannonImg = document.createElement("img")
    cannonImg.src = "resources/cannon.png"
    cannonImg.style.width = "50px"
    cannonImg.style.height = "50px"
    cannonImg.style.position = "absolute"

    cannonContainer.appendChild(cannonImg)
    cannonContainer.style.alignItems = "center"
    cannonContainer.style.justifyContent = "center"

    cannon.style.zIndex = "2"

    cannonContainer.style.backgroundImage = "url(resources/cannon.png)"
    cannonContainer.style.fontSize = "x-large"
    cannonContainer.style.width = "50px"
    cannonContainer.style.height = "50px"
    cannonContainer.style.position = "absolute"
    cannonContainer.style.boxShadow = "0 0 15px black"

    cannonContainer.appendChild(cannon)
    gameContainer.appendChild(cannonContainer)
}

function sharkWords(sharkElement, minDiff, maxDiff) {
    let oneWord = wordsApi[Math.floor(Math.random() * 178187)]

    if (oneWord.length <= maxDiff && oneWord.length >= minDiff) {
        let charIndex
        for (charIndex in oneWord) {
            let charSpan = document.createElement("span")
            charSpan.innerText = oneWord[charIndex]
            charSpan.style.fontSize = "large"
            sharkElement.append(charSpan)
        }

    } else {
        sharkWords(sharkElement, minDiff, maxDiff)
    }
}

function createShark(minimumDiff, maximumDiff, sharkSpeed) {
    let sharkImage = document.createElement('img')
    let dotDiv = document.createElement('div')
    dotDiv.className = 'dot'

    if (level == 1) {
        dotDiv.style.width = '200px'
        dotDiv.style.height = '90px'
        sharkImage.src = "resources/sharky.png"
    } else if (level == 3) {
        dotDiv.style.width = '250px'
        dotDiv.style.height = '120px'
        sharkImage.src = "resources/hammer.png"
    }
    creationOfDot(sharkImage, minimumDiff, maximumDiff, sharkSpeed, dotDiv)
}

function creationOfDot(sharkImage, minimumDiff, maximumDiff, sharkSpeed, dotDiv) {

    let sharkWord = document.createElement('div')
    sharkWord.className = 'words'
    sharkImage.style.width = "100%"
    sharkImage.style.height = "100%"

    dotDiv.style.top = topStyleArray[topStyleArrayIncrementer] + '%'
    topStyleIncrementer()
    dotDiv.style.margin = "4px"
    dotDiv.style.right = "-25%"
    dotDiv.append(sharkImage, sharkWord)
    gameContainer.appendChild(dotDiv)

    sharkWords(sharkWord, minimumDiff, maximumDiff)

    let shark = -25
    let firstRun = 1

    clearIntArray.push(setInterval(() => {
        if (level == 3) {
            if (shark >= 7) {
                if (firstRun == 1) {
                    firstRun = 2
                    sharkWord.innerHTML = ""
                    textContentReset()
                    setIndextoZero()
                    sharkWords(sharkWord, minimumDiff, maximumDiff)
                }
            }
        }
        if (shark >= 67) {
            if (level == 3) {
                sharkAtDiver()
            } else {
                clearIntArrayForEach()
                setClearIntArrayEmpty()
            }
        } else {
            shark += sharkSpeed;
            dotDiv.style.right = shark + "%"
        }
    }, 1, dotDiv, sharkSpeed, shark, firstRun, sharkWord, minimumDiff, maximumDiff))
    if (level == 3) {
        sharkWord.style.top = "46%"
        sharkWord.style.left = "40%"
        creationOfPiranha(sharkSpeed)
    }
}

function sharkAtDiver() {
    clearIntArrayForEach()
    setClearIntArrayEmpty()
    clearBossSharkInterval()
    totalTime = 0
    failPopUp.style.zIndex = "3"
    speedRoundStatsPopUpGamePointsInnerText()
    totalSharksKilledInnerText()
    document.body.removeEventListener("keydown", killShark)
    updateGame()
}
async function creationOfPiranha(sharkSpeed) {
    let charSpan = document.createElement("span")
    let sharkWord = document.createElement('div')
    let dotDiv = document.createElement('div')
    let sharkImage = document.createElement('img')

    sharkWord.append(charSpan)
    let charSpanIndex = Math.round(Math.random() * (asciiArray.length - 2))
    charSpan.innerText = asciiArray[charSpanIndex]
    charSpan.style.fontSize = "xx-large"
    sharkWord.style.left = "34%"
    sharkWord.style.top = "38%"
    charSpan.style.fontWeight = "bold"
    sharkWord.className = 'words'
    dotDiv.className = 'dot'
    dotDiv.style.width = '200px'
    dotDiv.style.height = '150px'
    sharkImage.style.maxHeight = "100%"
    sharkImage.style.maxWidth = "100%"
    dotDiv.style.top = topStyleArray[topStyleArrayIncrementer] + '%'
    topStyleIncrementer()
    dotDiv.style.margin = "4px"
    dotDiv.style.right = "-25%"
    sharkImage.src = "resources/pirahna.png"
    dotDiv.append(sharkImage, sharkWord)
    gameContainer.appendChild(dotDiv)

    let shark = -25
    dotDiv.style.opacity = "0.2"
    clearIntArray.push(setInterval(() => {
        if (shark >= 67) {
            sharkAtDiver()
        } else {
            shark += sharkSpeed;
            dotDiv.style.right = shark + "%"
            if (shark >= 20) {
                dotDiv.style.opacity = "1"
            }
        }
    }, 1, dotDiv, sharkSpeed, shark))
}

async function killShark(e) {

    let sharkFinder = gameContainer.querySelector(".dot")
    let sharkCharSpan = sharkFinder.querySelectorAll("span")
    let typedLetter = String.fromCharCode(e.which).toLowerCase()
    killAllSharks(sharkFinder, sharkCharSpan, typedLetter)
}
let cannonIntArrayIter = 0
function killAllSharks(sharkFinder, sharkCharSpan, typedLetter) {
    if (typedLetter == sharkCharSpan[index].innerText) {
        textContent += typedLetter
        sharkCharSpan[index].style.color = "green"
        index++
        if (textContent.length == sharkFinder.innerText.length) {
            if (textContent == sharkFinder.innerText) {
                pointsTotal = parseInt(pointsTotal) + parseInt(sharkFinder.innerText.length)
                sharksTotal++
                gameSharksKilled.innerText = " " + sharksTotal
                gamePointsInnerText()
                sharkFinder.className = "dead"
                if (level == 3) {
                    if (incrementer <= 23) {
                        if (sharkFinder.querySelector('img').src.endsWith('/resources/hammer.png')) {
                            sharkFinder.className = "dead2"
                            sharkFinder.querySelector('img').src = 'resources/skeleton.png'
                        }
                    } else if (incrementer > 25) {
                        bossPoints += 5
                        movingRedTimerBox.style.width = bossPoints + "%"
                        sharkFinder.className = "dead3"
                        clearInterval(cannonBallIntervalArr[cannonIntArrayIter])
                        cannonIntArrayIter++
                    }
                }
                clearInterval(clearIntArray[clearIndex])
                clearIndex++
                sharkFinder = gameContainer.querySelector(".dot")
                setIndextoZero()
            }
            textContentReset()
        }
    }
}

function updateGame() {
    fetch(`http://localhost:3000/games/${currentUserGameId}`, {
        method: 'PATCH',
        body: JSON.stringify({
            points: pointsTotal,
            sharks_killed: sharksTotal
        }),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    })
}

async function addGame() {
    await fetch("http://localhost:3000/games", {
        method: 'POST',
        body: JSON.stringify({
            points: pointsTotal,
            sharks_killed: sharksTotal,
            difficulty: chosenDifficulty,
            user_id: currentUserId
        }),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(result => {
            result.id
            currentUserGameId = result.id
        })
}

function updateUsersTotalPoints() {
    usersTotalPoints.innerText = "Total Points: " + currentUserPoints
}

function updateUsersTotalSharks() {
    usersTotalSharks.innerText = "Total Sharks Killed: " + currentUserSharks
}

function updateUsersTotalGamesPlayed() {
    userGames.innerText = "Total Games Played: " + currentUserGames
}

function updateUsersAvgDiff() {
    usersAvgDiff.innerText = "Average Difficulty: " + currentUserDiffAvg
}

function fillOutPopUpOverallStats() {
    usernameHeader.innerText = currentUser
    usernameHeader.style.textDecoration = "underline"
    updateUsersTotalPoints()
    updateUsersTotalSharks()
    updateUsersTotalGamesPlayed()
    updateUsersAvgDiff()

    overallStats.append(usernameHeader, usersTotalPoints, usersTotalSharks, userGames, usersAvgDiff)
}

function mapAllUsersGames() {
    allGames.innerHTML = `<h2 style="text-decoration: underline;">All Games</h2>`

    currentUsersGamesObj.map(game => {
        let gameInstance = document.createElement("h6")
        gameInstance.innerHTML = "Game: POINTS = " + game.points + ", SHARKS = " + game.sharks_killed + ", DIFFICULTY = " + game.difficulty + "<button id=" + game.id + " class='deleteButton' style='max-width: 5%; max-height: 5%;'>x</button>"
        gameInstance.textDecoration = "underline"

        allGames.append(gameInstance)
    })

    document.querySelectorAll(".deleteButton").forEach(game => {
        game.addEventListener("click", async (event) => {
            event.target.parentNode.remove()
            await fetch(`http://localhost:3000/games/${event.target.id}`, {
                method: 'DELETE'
            })
            fetch(`http://localhost:3000/users/${currentUserId}`)
                .then(response => response.json())
                .then(redefineStats)
        })
    })
}

function fillOutPopUpOverallGames() {
    mapAllUsersGames()
}

function reloadGame() {
    document.getElementById("underline4").innerText = ""

    setChosenDifficultytoEasy()
    setDiffButtonsandStartButtonDisplayBlock()
    setGameStatsBarEntriestoZero()
    setIndextoZero()
    setClearIntArrayEmpty()
    removeSharks()
    cannonIntArrayIter = 0
    bossShark.style.display = "none"
    movingRedTimerBox.style.display = "none"
    movingRedTimerBox.style.width = "0%"
    movingTimerBox.style.display = "none"
    bossShark.style.zIndex = "1"
    game3TimeClearInterval()
    gameContainer.style.backgroundImage = "url('https://giffiles.alphacoders.com/195/19518.gif')"
    level = 1
    bossWarningOff()
    document.querySelector(".victory").style.display = "none"
    continueButton.style.display = "block"
}

function setGameStatsBarEntriestoZero() {
    gamePoints.innerText = "0"
    allSharksKilledText.innerText = "0"
    timer.innerText = "0"
    clearIndex = 0
}

function setDiffButtonsandStartButtonDisplayBlock() {
    startButton.style.display = "block"
    easyButton.style.display = "block"
    mediumButton.style.display = "block"
    hardButton.style.display = "block"
}

function updateAllUsersStats() {
    updateUsersTotalPoints()
    updateUsersTotalSharks()
    updateUsersTotalGamesPlayed()
    updateUsersAvgDiff()
    mapAllUsersGames()
}

function redefineStats(response) {
    currentUser = response.username
    currentUserId = response.id
    currentUserGames = response.total_games
    currentUserPoints = response.total_points
    currentUserSharks = response.total_sharks_killed
    currentUsersGamesObj = response.games
    currentUserDiffAvg = response.avg_difficulty

    updateAllUsersStats()
}

